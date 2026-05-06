# The Vault

TCG inventory & arbitrage app for cross-border (US ↔ EU) card trading.

## Stack

- Next.js 14 App Router (TypeScript)
- Tailwind CSS + shadcn/ui-style primitives
- `@supabase/ssr` for cookie-based auth (no `auth-helpers`)
- TanStack Query for client-side data fetching
- Configured as an installable PWA
- Deploys to **Cloudflare Pages** via `@cloudflare/next-on-pages`

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values from Supabase dashboard
npm run dev
```

### Environment variables

| Var | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gcdskpynfpbxazeapgls.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project anon key |

Set the same variables in **Cloudflare Pages → Settings → Environment variables**.

## Auth

- Sign-up is disabled — admins invite users via the Supabase dashboard.
- The middleware (`middleware.ts`) refreshes the session cookie on every request and
  redirects unauthenticated users to `/login` (preserving `?next=`).
- The `(app)` route group is gated server-side via `getUser()` in `app/(app)/layout.tsx`.

## Pages (Phase 1)

- `/dashboard` — counts by inventory status, recent items, open trips.
- `/inventory` — searchable, sortable, filterable list. Detail at `/inventory/:id`. Edit at `/inventory/:id/edit`.
- `/trips` — list of trips with totals from the `trip_totals` view. Detail at `/trips/:id` showing assigned items + amortization.
- `/calculator` — tabs for **Floor price** (calls `calc_floor_price`) and **Max buy** (calls `calc_max_buy_price`).
- `/settings` — profile + (admin only) edit rows in the `settings` table.

## Cloudflare Pages deployment

`next-on-pages` builds the worker output:

```bash
npm run pages:build
npm run pages:deploy
```

In the Cloudflare Pages dashboard:

- **Build command**: `npm run pages:build`
- **Build output directory**: `.vercel/output/static`
- **Compatibility flags**: `nodejs_compat`
- **Environment variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## PWA

`public/manifest.webmanifest` + `public/sw.js` register on load. Replace the placeholder icons in `public/icons/` with real artwork before shipping.

## Out of scope (Phase 2/3)

- Price feeds, charts, buyer view, consignor view, image uploads.
- Frontend RBAC: surface-level only today (e.g. settings edit gating). Database RLS will be added next; the frontend renders whatever rows it gets back.
