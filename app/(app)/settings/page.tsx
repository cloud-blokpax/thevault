import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("role, display_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("settings").select("*").order("key"),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Margins, splits, and operational defaults.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="font-medium">{profile?.email ?? user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
              <dd className="font-medium">{profile?.role ?? "—"}</dd>
            </div>
          </dl>
          <form action="/api/auth/signout" method="post" className="mt-4">
            <button className="text-sm font-medium text-primary hover:underline">Sign out</button>
          </form>
        </CardContent>
      </Card>

      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only admins can edit margins and splits. Contact an admin if you need a change.{" "}
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to dashboard
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <SettingsForm initialSettings={settings ?? []} />
      )}
    </div>
  );
}
