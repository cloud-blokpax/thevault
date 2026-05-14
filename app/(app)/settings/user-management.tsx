"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Mail, Trash2, UserCog, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";

type Role = "admin" | "user";

type ProfileRow = {
  id: string;
  email: string;
  role: Role;
  created_at: string;
};

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const usersQuery = useQuery<ProfileRow[]>({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("user");
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: Role }) => {
      const { data, error } = await supabase.functions.invoke(
        "admin-invite-user",
        { body: payload },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setFeedback({ kind: "success", text: `Invite sent to ${inviteEmail}.` });
      setInviteEmail("");
      setInviteRole("user");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (err: Error) => {
      setFeedback({ kind: "error", text: err.message });
    },
  });

  const [roleEditFor, setRoleEditFor] = useState<ProfileRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<ProfileRow | null>(null);

  const users = usersQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">User management</CardTitle>
        <p className="text-xs text-muted-foreground">
          Invite teammates and manage roles. Admins can edit settings and add drops.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFeedback(null);
            inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
          }}
          className="space-y-3 rounded-lg border bg-muted/30 p-3"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Invite a new user
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <div className="space-y-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email
              </Label>
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                spellCheck={false}
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role" className="sr-only">
                Role
              </Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={inviteMutation.isPending || !inviteEmail.includes("@")}
              className="h-10"
            >
              {inviteMutation.isPending ? "Sending…" : "Send invite"}
            </Button>
          </div>
          {feedback && (
            <p
              role={feedback.kind === "error" ? "alert" : "status"}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                feedback.kind === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive",
              )}
            >
              {feedback.kind === "success" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {feedback.text}
            </p>
          )}
        </form>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Existing users{" "}
              <span className="font-normal text-muted-foreground/80">
                · {users.length}
              </span>
            </p>
            {usersQuery.isFetching && (
              <span className="text-xs text-muted-foreground">Refreshing…</span>
            )}
          </div>

          {usersQuery.error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              Failed to load users: {(usersQuery.error as Error).message}
            </p>
          )}

          {!usersQuery.isLoading && users.length === 0 && (
            <p className="text-xs text-muted-foreground">No users yet.</p>
          )}

          <ul className="divide-y rounded-lg border">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <li
                  key={u.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(u.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={u.role} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 px-2.5"
                      onClick={() => setRoleEditFor(u)}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">Role</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteFor(u)}
                      disabled={isSelf}
                      title={isSelf ? "You cannot remove yourself" : "Remove user"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">Remove</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>

      <RoleDialog
        user={roleEditFor}
        currentUserId={currentUserId}
        onClose={() => setRoleEditFor(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
          queryClient.invalidateQueries({ queryKey: ["my-profile"] });
        }}
      />

      <DeleteDialog
        user={deleteFor}
        onClose={() => setDeleteFor(null)}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
        }}
      />
    </Card>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        role === "admin"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}

function RoleDialog({
  user,
  currentUserId,
  onClose,
  onSaved,
}: {
  user: ProfileRow | null;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setRole(role: Role) {
    if (!user) return;
    setPending(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-update-user-role",
        { body: { user_id: user.id, role } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const open = user !== null;
  const isSelf = user?.id === currentUserId;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col gap-3 border bg-background p-4 shadow-lg",
            "inset-x-0 bottom-0 max-h-[90vh] rounded-t-xl pb-[max(env(safe-area-inset-bottom),1rem)]",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-4",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <Dialog.Title className="text-base font-semibold">
                Change role
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {user?.email}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <div className="grid gap-2">
            <RoleOption
              role="admin"
              active={user?.role === "admin"}
              onSelect={() => setRole("admin")}
              disabled={pending}
              description="Can manage users, settings, and drops."
            />
            <RoleOption
              role="user"
              active={user?.role === "user"}
              onSelect={() => setRole("user")}
              disabled={pending}
              description="Read-only on settings; can manage their inventory & trips."
            />
          </div>

          {isSelf && (
            <p className="text-[11px] text-muted-foreground">
              You can&apos;t demote yourself if you&apos;re the only admin.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RoleOption({
  role,
  active,
  description,
  disabled,
  onSelect,
}: {
  role: Role;
  active: boolean;
  description: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || active}
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "hover:bg-accent disabled:opacity-50",
      )}
    >
      <div className="space-y-0.5">
        <p className="text-sm font-semibold capitalize">{role}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {active && <Check className="mt-0.5 h-4 w-4 text-primary" />}
    </button>
  );
}

function DeleteDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: ProfileRow | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!user) return;
    setPending(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-delete-user",
        { body: { user_id: user.id } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      onDeleted();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  const open = user !== null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col gap-3 border bg-background p-4 shadow-lg",
            "inset-x-0 bottom-0 max-h-[90vh] rounded-t-xl pb-[max(env(safe-area-inset-bottom),1rem)]",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-4",
          )}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <Dialog.Title className="text-base font-semibold">
                Remove user
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Permanently delete <span className="font-medium">{user?.email}</span>.
                Their inventory and trips remain but become orphaned.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={pending}
            >
              {pending ? "Removing…" : "Remove user"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
