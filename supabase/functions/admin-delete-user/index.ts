import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: caller } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (caller?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id) return json({ error: "user_id required" }, 400);

    if (user_id === user.id) {
      return json({ error: "Cannot delete your own account" }, 400);
    }

    const { error } = await adminClient.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
