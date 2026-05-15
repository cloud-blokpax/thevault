// drop-monitor: edge function that powers the per-link drop watcher.
//
// Modes
//   - dispatch:  cron entrypoint. Claims a batch of due links, fetches each,
//                runs its retailer detector, persists the result, and triggers
//                a push notification when an out → in transition happens.
//   - check-one: on-demand single-link check. Called internally by the
//                drop-check-link function after user auth + rate-limit checks.
//
// Auth: either x-cron-secret (matches the Vault cron_secret) OR an
// Authorization: Bearer <SERVICE_ROLE_KEY> header so the on-demand wrapper
// can re-enter without exposing the cron secret.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detect } from "./detectors.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-cron-secret, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type ClaimedLink = {
  link_id: string;
  drop_id: string;
  url: string;
  retailer: string | null;
  detector_hint: string | null;
  monitor_mode: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Auth: cron secret OR service-role bearer
  const cronHeader = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerMatches = authHeader.toLowerCase().startsWith("bearer ")
    && authHeader.slice(7).trim() === SERVICE_KEY;

  let authorized = bearerMatches;
  if (!authorized && cronHeader) {
    const { data: vaultSecret } = await admin.rpc("get_vault_secret", {
      p_name: "cron_secret",
    });
    if (typeof vaultSecret === "string" && vaultSecret === cronHeader) {
      authorized = true;
    }
  }
  if (!authorized) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const mode = (body as { mode?: string }).mode ?? "dispatch";

  if (mode === "dispatch") {
    const batchSize =
      typeof (body as { batch_size?: number }).batch_size === "number"
        ? (body as { batch_size: number }).batch_size
        : 10;
    return await runDispatch(admin, batchSize);
  }
  if (mode === "check-one") {
    const linkId = (body as { link_id?: string }).link_id;
    if (!linkId) return json({ ok: false, error: "link_id required" }, 400);
    return await runCheckOne(admin, linkId);
  }
  return json({ ok: false, error: "unknown_mode" }, 400);
});

async function runDispatch(admin: SupabaseClient, batchSize: number) {
  const { data: links, error } = await admin.rpc("monitor_claim_due_links", {
    p_limit: batchSize,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  const claimed = (links ?? []) as ClaimedLink[];
  if (claimed.length === 0) return json({ ok: true, processed: 0 });

  const results: unknown[] = [];
  for (const link of claimed) {
    const domain = safeHost(link.url);
    if (domain) await respectDomainGap(admin, domain);

    const { data: quota } = await admin.rpc("monitor_try_consume_call", { p_calls: 1 });
    if (!(quota as { allowed?: boolean } | null)?.allowed) {
      results.push({ link_id: link.link_id, skipped: "quota" });
      break;
    }
    results.push(await checkLink(admin, link));
  }
  return json({ ok: true, processed: results.length, results });
}

async function runCheckOne(admin: SupabaseClient, linkId: string) {
  const { data: rows, error } = await admin
    .from("drop_retailer_links")
    .select("id, drop_id, url, retailer, detector_hint, monitor_mode")
    .eq("id", linkId)
    .limit(1);
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: false, error: "not_found" }, 404);

  const row = rows[0] as Record<string, unknown>;
  if (!row.url || typeof row.url !== "string") {
    return json({ ok: false, error: "link_has_no_url" }, 400);
  }

  // Daily quota still applies to manual checks (mirrors eBay button)
  const { data: quota } = await admin.rpc("monitor_try_consume_call", { p_calls: 1 });
  if (!(quota as { allowed?: boolean } | null)?.allowed) {
    return json({ ok: false, error: "daily_quota_exceeded" }, 429);
  }

  const result = await checkLink(admin, {
    link_id: row.id as string,
    drop_id: row.drop_id as string,
    url: row.url,
    retailer: (row.retailer as string | null) ?? null,
    detector_hint: (row.detector_hint as string | null) ?? null,
    monitor_mode: (row.monitor_mode as string) ?? "off",
  });
  return json({ ok: true, result });
}

async function checkLink(admin: SupabaseClient, link: ClaimedLink) {
  const start = Date.now();

  if (!link.url) {
    await admin.rpc("monitor_record_result", {
      p_link_id: link.link_id,
      p_state: "error",
      p_duration_ms: 0,
      p_error: "empty_url",
    });
    return { link_id: link.link_id, state: "error", error: "empty_url" };
  }

  try {
    const res = await fetch(link.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheVaultBot/1.0; +https://thevault.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();
    const detected = detect(link.detector_hint ?? link.retailer ?? "", html, link.url);
    const ms = Date.now() - start;

    const { data: rec, error: recErr } = await admin.rpc("monitor_record_result", {
      p_link_id: link.link_id,
      p_state: detected.state,
      p_price: detected.price ?? null,
      p_currency: detected.currency ?? null,
      p_http_status: res.status,
      p_duration_ms: ms,
      p_signals: detected.signals,
      p_error: null,
    });
    if (recErr) {
      return { link_id: link.link_id, state: detected.state, ms, record_error: recErr.message };
    }

    const recBody = rec as {
      should_alert?: boolean;
      alert_user_ids?: string[];
    } | null;

    if (recBody?.should_alert) {
      // Fire-and-forget Web Push (don't block batch).
      admin.functions
        .invoke("notify-user", {
          body: {
            kind: "drop_in_stock",
            link_id: link.link_id,
            drop_id: link.drop_id,
            user_ids: recBody.alert_user_ids ?? [],
          },
        })
        .catch(() => {});
    }
    return { link_id: link.link_id, state: detected.state, ms };
  } catch (e) {
    const ms = Date.now() - start;
    await admin.rpc("monitor_record_result", {
      p_link_id: link.link_id,
      p_state: "error",
      p_duration_ms: ms,
      p_error: String(e).slice(0, 300),
    });
    return { link_id: link.link_id, state: "error", error: String(e).slice(0, 100) };
  }
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

async function respectDomainGap(admin: SupabaseClient, domain: string) {
  const { data: gapS } = await admin
    .from("settings")
    .select("value")
    .eq("key", "monitor_domain_min_gap_s")
    .maybeSingle();
  const gapMs = (Number((gapS as { value?: number } | null)?.value) || 10) * 1000;

  const { data: lock } = await admin
    .from("monitor_domain_locks")
    .select("last_call_at")
    .eq("domain", domain)
    .maybeSingle();
  if (lock) {
    const elapsed =
      Date.now() - new Date((lock as { last_call_at: string }).last_call_at).getTime();
    if (elapsed < gapMs) await new Promise((r) => setTimeout(r, gapMs - elapsed));
  }
  await admin
    .from("monitor_domain_locks")
    .upsert({ domain, last_call_at: new Date().toISOString() });
}
