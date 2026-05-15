"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace(
          "/auth/error?message=" +
            encodeURIComponent("Invalid or expired invitation link"),
        );
        return;
      }
      setUserEmail(session.user.email ?? "");
      const tempPass = session.user.user_metadata?.temporary_password;
      if (typeof tempPass === "string" && tempPass.length > 0) {
        setTemporaryPassword(tempPass);
      }
      setLoading(false);
    }
    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (temporaryPassword && password === temporaryPassword) {
      setError("Choose a password different from the temporary one.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        password_changed: true,
        must_change_password: false,
        temporary_password: null,
      },
    });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Verifying your invitation…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">
            {temporaryPassword ? "Change your password" : "Set your password"}
          </CardTitle>
          <CardDescription>
            {userEmail ? `Welcome, ${userEmail}.` : "Welcome."}{" "}
            {temporaryPassword
              ? "Replace your temporary password to finish setup."
              : "Choose a password to finish setting up your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {temporaryPassword && (
            <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="font-semibold uppercase tracking-wide text-primary">
                Temporary password from admin
              </p>
              <p className="mt-1 break-all rounded border bg-background px-2 py-1 font-mono text-sm">
                {temporaryPassword}
              </p>
              <p className="mt-2 text-muted-foreground">
                Use this only for first sign-in. You must pick a new one below.
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                At least 6 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Setting password…" : "Set password & continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
