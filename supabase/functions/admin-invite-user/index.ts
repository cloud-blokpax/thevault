import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SITE_URL =
      Deno.env.get("SITE_URL") ?? Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid token" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: callerProfile, error: profErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profErr || callerProfile?.role !== "admin") {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { email, role = "user", temporaryPassword } = body ?? {};

    if (typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Valid email required" }, 400);
    }
    if (!["admin", "user"].includes(role)) {
      return json({ error: "Invalid role" }, 400);
    }

    const hasTempPassword =
      typeof temporaryPassword === "string" && temporaryPassword.length > 0;
    if (hasTempPassword && temporaryPassword.length < 6) {
      return json({ error: "Temporary password must be at least 6 characters" }, 400);
    }

    const redirectTo = SITE_URL
      ? `${SITE_URL.replace(/\/$/, "")}/auth/set-password`
      : undefined;

    const inviteMetadata: Record<string, unknown> = {
      invited_by: user.id,
      invited_at: new Date().toISOString(),
    };
    if (hasTempPassword) {
      inviteMetadata.temporary_password = temporaryPassword;
      inviteMetadata.must_change_password = true;
      inviteMetadata.password_changed = false;
    }

    const { data: invited, error: inviteErr } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: inviteMetadata,
        redirectTo,
      });
    if (inviteErr || !invited?.user) {
      return json({ error: inviteErr?.message ?? "Invite failed" }, 400);
    }

    if (hasTempPassword) {
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(
        invited.user.id,
        { password: temporaryPassword },
      );
      if (pwErr) {
        return json(
          {
            error: "Invite sent but failed to set temporary password: " + pwErr.message,
            user_id: invited.user.id,
          },
          500,
        );
      }
    }

    const { error: upsertErr } = await adminClient
      .from("profiles")
      .upsert({
        id: invited.user.id,
        email: invited.user.email,
        role,
      });
    if (upsertErr) {
      return json(
        {
          error: "User invited but role not applied: " + upsertErr.message,
          user_id: invited.user.id,
        },
        500,
      );
    }

    return json({
      success: true,
      user: { id: invited.user.id, email: invited.user.email, role },
      temporary_password_set: hasTempPassword,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
