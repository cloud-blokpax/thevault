"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Subscription = {
  id: number;
  endpoint: string;
  device_label: string | null;
  created_at: string;
};

// base64url → Uint8Array (PushManager.subscribe expects raw bytes)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function abToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function PushNotifications({ userId }: { userId: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">(
    "unknown",
  );
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  useEffect(() => {
    const has = typeof window !== "undefined"
      && "serviceWorker" in navigator
      && "PushManager" in window;
    setSupported(has);
    if (has) setPermission(Notification.permission);

    const supabase = createClient();
    supabase
      .from("settings")
      .select("value")
      .eq("key", "vapid_public_key")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: unknown } | null)?.value;
        if (typeof v === "string" && v) setVapidKey(v);
      });
    supabase
      .from("push_subscriptions" as never)
      .select("id, endpoint, device_label, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSubs(((data as unknown as Subscription[]) ?? []));
      });

    if (has) {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setCurrentEndpoint(sub.endpoint);
        }),
      );
    }
  }, [userId]);

  async function enable() {
    setError(null);
    if (!supported) {
      setError("This browser doesn't support push notifications.");
      return;
    }
    if (!vapidKey) {
      setError(
        "VAPID public key not configured — set it in Supabase Vault + the `vapid_public_key` setting.",
      );
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Notification permission denied.");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      const keyBytes = urlBase64ToUint8Array(vapidKey);
      // Re-pack into a fresh ArrayBuffer to satisfy the BufferSource constraint
      // (Uint8Array<ArrayBufferLike> isn't assignable directly in lib.dom).
      const applicationServerKey = keyBytes.slice().buffer as ArrayBuffer;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const endpoint = json.endpoint ?? sub.endpoint;
      const p256dh =
        json.keys?.p256dh ?? abToBase64(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? abToBase64(sub.getKey("auth"));

      const supabase = createClient();
      const { error: err } = await supabase
        .from("push_subscriptions" as never)
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            device_label:
              navigator.userAgent.match(/(iPhone|iPad|Android|Macintosh|Windows|Linux)/)?.[1] ??
              null,
          } as never,
          { onConflict: "user_id,endpoint" } as never,
        );
      if (err) {
        setError(err.message);
        return;
      }
      setCurrentEndpoint(endpoint);
      const { data: refreshed } = await supabase
        .from("push_subscriptions" as never)
        .select("id, endpoint, device_label, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setSubs(((refreshed as unknown as Subscription[]) ?? []));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disableHere() {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const supabase = createClient();
        await supabase
          .from("push_subscriptions" as never)
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", endpoint);
        setCurrentEndpoint(null);
        setSubs((s) => s.filter((x) => x.endpoint !== endpoint));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRemote(id: number) {
    const supabase = createClient();
    await supabase.from("push_subscriptions" as never).delete().eq("id", id);
    setSubs((s) => s.filter((x) => x.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Drop alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Push notification when a watched retailer link flips to in-stock.
          Permission is per-device — enable on each phone/desktop you want pinged.
        </p>
        {supported === false && (
          <p className="text-xs text-destructive">
            This browser doesn&apos;t support Web Push.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {currentEndpoint ? (
            <Button size="sm" variant="outline" onClick={disableHere} disabled={busy}>
              <BellOff className="mr-1 h-3 w-3" />
              Disable on this device
            </Button>
          ) : (
            <Button size="sm" onClick={enable} disabled={busy || supported === false}>
              {busy ? (
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Bell className="mr-1 h-3 w-3" />
              )}
              Enable on this device
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Permission: {permission}
          </span>
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        {subs.length > 0 && (
          <div className="space-y-1 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registered devices ({subs.length})
            </p>
            <ul className="space-y-1">
              {subs.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded border px-2 py-1.5 text-xs"
                >
                  <span className="truncate">
                    {s.device_label ?? "Unknown device"}{" "}
                    <span className="text-muted-foreground">
                      · {new Date(s.created_at).toLocaleDateString()}
                    </span>
                    {s.endpoint === currentEndpoint && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        this device
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRemote(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
