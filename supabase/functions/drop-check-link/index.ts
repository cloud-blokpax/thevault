// drop-check-link: on-demand "Check now" endpoint for the drops UI.
//
// Flow:
//   1. Validate user JWT.
//   2. Call monitor_try_user_check RPC (per-user hourly limit +
//      per-link cooldown). Returns 429 if blocked.
//   3. Forward to drop-monitor with mode=check-one, authenticated
//      via the service-role bearer.
//   4. Return the resulting state to the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Invalid token" }, 401);

  const { link_id } = await req.json().catch(() => ({}));
  if (typeof link_id !== "string" || !link_id) {
    return json({ error: "link_id required" }, 400);
  }

  // Rate-limit check using the user's session (so auth.uid() is set).
  const { data: gate, error: gateErr } = await userClient.rpc(
    "monitor_try_user_check",
    { p_link_id: link_id },
  );
  if (gateErr) return json({ error: gateErr.message }, 500);
  const gateBody = gate as {
    allowed?: boolean;
    reason?: string;
    retry_after_s?: number;
    used?: number;
    limit?: number;
  } | null;
  if (!gateBody?.allowed) {
    return json(
      {
        error: "rate_limited",
        reason: gateBody?.reason ?? "limit",
        retry_after_s: gateBody?.retry_after_s,
        used: gateBody?.used,
        limit: gateBody?.limit,
      },
      429,
    );
  }

  // Forward to drop-monitor with service-role bearer so we don't
  // need to share the cron secret with this function.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/drop-monitor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ mode: "check-one", link_id }),
  });

  const out = await res.json().catch(() => ({ error: "bad_monitor_response" }));
  return json(out, res.status);
});
