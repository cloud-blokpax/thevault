// notify-user: dispatches a Web Push (with email fallback) when
// a drop transitions from out-of-stock → in-stock.
//
// Invoked by drop-monitor with body
//   { kind: "drop_in_stock", drop_id, link_id, user_ids: uuid[] }
//
// Looks up the user's push_subscriptions and sends a notification
// to each endpoint. Failed subscriptions are pruned. If a user has
// no active subscriptions, falls back to a Resend email when both
// `resend_api_key` is in the Vault and a profile email exists.
//
// VAPID keys come from Supabase Vault:
//   vapid_public_key, vapid_private_key, vapid_subject (mailto:…)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type Subscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Auth: service-role bearer OR cron secret. This is server-only.
  const authHeader = req.headers.get("authorization") ?? "";
  const cronHeader = req.headers.get("x-cron-secret");
  let authorized =
    authHeader.toLowerCase().startsWith("bearer ") &&
    authHeader.slice(7).trim() === SERVICE_KEY;
  if (!authorized && cronHeader) {
    const { data: vaultSecret } = await admin.rpc("get_vault_secret", {
      p_name: "cron_secret",
    });
    if (typeof vaultSecret === "string" && vaultSecret === cronHeader) {
      authorized = true;
    }
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const kind = body.kind as string | undefined;
  const dropId = body.drop_id as string | undefined;
  const linkId = body.link_id as string | undefined;
  const userIds = (body.user_ids as string[] | undefined) ?? [];
  if (!kind || userIds.length === 0) {
    return json({ ok: true, skipped: "no_recipients" });
  }

  // Pull drop + link details for the notification body.
  const [{ data: drop }, { data: link }] = await Promise.all([
    dropId
      ? admin
          .from("product_drops")
          .select("name, set_name, image_url, msrp_usd")
          .eq("id", dropId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    linkId
      ? admin
          .from("drop_retailer_links")
          .select("retailer, url")
          .eq("id", linkId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const dropRow = drop as { name?: string; image_url?: string; msrp_usd?: number | null } | null;
  const linkRow = link as { retailer?: string; url?: string } | null;
  const title = `${dropRow?.name ?? "Drop"} is in stock`;
  const retailerLabel = (linkRow?.retailer ?? "retailer").replace(/_/g, " ");
  const message =
    `${retailerLabel} just flipped to in-stock` +
    (dropRow?.msrp_usd ? ` · MSRP $${dropRow.msrp_usd}` : "");

  // Configure web-push with Vault VAPID keys.
  const [{ data: pubKey }, { data: privKey }, { data: subject }] = await Promise.all([
    admin.rpc("get_vault_secret", { p_name: "vapid_public_key" }),
    admin.rpc("get_vault_secret", { p_name: "vapid_private_key" }),
    admin.rpc("get_vault_secret", { p_name: "vapid_subject" }),
  ]);

  if (
    typeof pubKey === "string" &&
    typeof privKey === "string" &&
    typeof subject === "string"
  ) {
    webpush.setVapidDetails(subject, pubKey, privKey);
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const subsList = (subs ?? []) as (Subscription & { user_id: string })[];
  const usersWithSubs = new Set(subsList.map((s) => s.user_id));

  const payload = JSON.stringify({
    title,
    body: message,
    url: linkRow?.url ?? `/drops`,
    icon: dropRow?.image_url ?? "/icons/icon-192.png",
    tag: linkId ?? dropId,
  });

  let pushSent = 0;
  const stale: number[] = [];
  if (typeof pubKey === "string" && typeof privKey === "string") {
    for (const sub of subsList) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        pushSent++;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    }
  }
  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }

  // Email fallback for users with no active subscriptions.
  const usersWithoutSubs = userIds.filter((id) => !usersWithSubs.has(id));
  let emailsSent = 0;
  if (usersWithoutSubs.length > 0) {
    const { data: resendKey } = await admin.rpc("get_vault_secret", {
      p_name: "resend_api_key",
    });
    if (typeof resendKey === "string" && resendKey) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, display_name")
        .in("id", usersWithoutSubs);
      const recipients = ((profiles ?? []) as { email: string | null }[])
        .map((p) => p.email)
        .filter((e): e is string => Boolean(e));
      if (recipients.length > 0) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "The Vault <drops@thevault.app>",
              to: recipients,
              subject: title,
              text:
                `${message}\n\n` +
                (linkRow?.url
                  ? `Go to listing: ${linkRow.url}\n`
                  : `Drop: ${dropRow?.name ?? "—"}\n`),
            }),
          });
          if (res.ok) emailsSent = recipients.length;
        } catch {
          /* swallow */
        }
      }
    }
  }

  return json({
    ok: true,
    push_sent: pushSent,
    push_stale_pruned: stale.length,
    emails_sent: emailsSent,
  });
});
