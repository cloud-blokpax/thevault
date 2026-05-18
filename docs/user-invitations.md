# User invitation & password reset

Two ways to onboard a user, plus a self-service password reset.

## Flow A — Admin sets temporary password (recommended)

1. Admin opens Settings → User management, enters email + role, checks
   **Set temporary password**, types or generates one.
2. `admin-invite-user` calls `auth.admin.createUser({ email, password,
   email_confirm: true, user_metadata: { must_change_password: true, ... } })`.
   **No email is sent.** The user is created already-confirmed.
3. Admin communicates the temp password to the user out-of-band
   (Slack/SMS/in person).
4. User goes to `/login`, signs in with email + temp password — works
   immediately because the email is pre-confirmed.
5. Middleware sees `user_metadata.must_change_password === true` and
   redirects any non-auth route to `/auth/set-password`.
6. User sets a new password; the metadata flag clears; they land on
   `/dashboard`.

## Flow B — Email invite (user picks their own password)

1. Admin submits email + role with **Set temporary password** unchecked.
2. `admin-invite-user` calls `auth.admin.inviteUserByEmail(email, { data,
   redirectTo })`. Supabase sends the standard invite email.
3. The link goes to `/auth/confirm?token_hash=…&type=invite&next=/auth/set-password`.
4. `/auth/confirm` verifies the OTP, establishes a session, and redirects
   to `/auth/set-password`.
5. User chooses a password; lands on `/dashboard`.

## Flow C — Forgot / reset password (self-service)

1. User clicks **Forgot password?** on `/login`.
2. `/auth/forgot-password` calls `supabase.auth.resetPasswordForEmail(email,
   { redirectTo: <site>/auth/reset-password })`.
3. Supabase sends a recovery email. The link goes to
   `/auth/confirm?token_hash=…&type=recovery&next=/auth/reset-password`.
4. `/auth/confirm` verifies the OTP and redirects to `/auth/reset-password`.
5. User sets a new password; lands on `/dashboard`.

## Required Supabase configuration

### Authentication → URL Configuration

- **Site URL**: production origin (e.g. `https://yourdomain.com`).
- **Additional Redirect URLs**:
  - `https://yourdomain.com/auth/confirm`
  - `https://yourdomain.com/auth/set-password`
  - `https://yourdomain.com/auth/reset-password`

### Authentication → Email Templates

**Invite user** template:

    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password">
      Accept invitation & set password
    </a>

**Reset password** template:

    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password">
      Reset your password
    </a>

### Edge function env

`admin-invite-user` reads `SITE_URL` (falls back to `NEXT_PUBLIC_SITE_URL`).
Only needed for Flow B (email invites). Set it via:

    supabase secrets set SITE_URL=https://yourdomain.com

## Notes

- `on_auth_user_created` creates the `profiles` row automatically;
  `admin-invite-user` upserts the role afterward.
- Middleware allows `/auth/*` and `/login` for unauthenticated users so the
  reset/invite links can complete.
- The set-password page rejects reusing the displayed temporary password.
- For Flow A, `email_confirm: true` is what unblocks immediate login —
  `inviteUserByEmail` does NOT pre-confirm the email, which is why setting
  a password on an invited user previously appeared "not to work."
