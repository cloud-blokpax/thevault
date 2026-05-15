# User invitation system

Hybrid invite flow: admins send invites from Settings → User management, with
an optional temporary password. Invited users always land on a password-setup
page before they can use the app.

## Flow

1. Admin (Settings → User management) submits an email + role. They can
   optionally check **Set temporary password** and enter / generate one.
2. The `admin-invite-user` edge function calls
   `auth.admin.inviteUserByEmail(email, { data, redirectTo })`. If a temporary
   password was supplied, it is stored in `user_metadata.temporary_password`
   and also set on the auth user via `auth.admin.updateUserById`.
3. The invitee receives the standard Supabase invite email. The link points at
   `/auth/confirm?token_hash=…&type=invite&next=/auth/set-password`.
4. `/auth/confirm` verifies the OTP, establishes a session, and redirects to
   `/auth/set-password`.
5. `/auth/set-password` reads the session and — if there is a temporary
   password in `user_metadata` — displays it. The user must choose a new
   password, which clears the temp-password metadata.

## Required Supabase configuration

These live in the Supabase dashboard, not in the repo:

### Authentication → URL Configuration

- **Site URL**: production origin (e.g. `https://yourdomain.com`).
- **Additional Redirect URLs**:
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/set-password`
  - `https://yourdomain.com/auth/confirm`
  - `https://yourdomain.com/auth/set-password`

### Authentication → Email Templates → Invite user

Replace the default link with one that targets our confirm route:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password">
  Accept invitation & set password
</a>
```

### Edge function env

`admin-invite-user` reads `SITE_URL` (falls back to `NEXT_PUBLIC_SITE_URL`) to
build the `redirectTo`. Set one of those in the function's secrets, e.g.

```bash
supabase secrets set SITE_URL=https://yourdomain.com
```

## Local environment

Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The service-role key only needs to live in the edge function's secrets —
never in `NEXT_PUBLIC_*` vars.

## Notes

- The `on_auth_user_created` trigger creates a `profiles` row automatically;
  `admin-invite-user` then upserts the chosen role.
- Middleware allows `/auth/*` and `/login` for unauthenticated users so the
  invite link can complete the flow.
- The set-password page rejects reusing the temporary password.
