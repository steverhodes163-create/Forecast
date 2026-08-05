# YASA Resource Forecasting — Web App

Phase 1 (Foundations) of the platform described in `../docs/Solution-Architecture.md`
(see §0 Platform Decision Addendum for why this is a web app rather than an Excel
workbook, and what does/doesn't change from the original architecture).

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend + server actions
- **PostgreSQL** via **Prisma 7** (`@prisma/adapter-pg` driver adapter) — the relational
  data model, a direct translation of the architecture doc's §5 table definitions
- **Auth**: custom, cookie-based sessions (JWT via `jose`), `bcryptjs` password hashing,
  role-based access control via `AppRole` — this is what closes the §17/§11 gap Excel
  couldn't: real multi-user access with real per-route authorization, not just a hidden tab.
- **Tailwind CSS 4** for styling

## Local setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate dev # creates all tables from prisma/schema.prisma
npx prisma db seed     # loads fictional demo data (org, projects, forecast rows)
npm run dev
```

Demo login: `admin@yasa.local` / `ChangeMe123!` (seeded — change/remove before any
non-local use).

To reseed from a clean slate, use `npx prisma migrate reset` (destructive — drops and
recreates the local dev database; never run against a shared/production database).

## What's here (Phase 1 scope)

- The full relational schema (`prisma/schema.prisma`) — every `dim_`/`fact_`/`brg_` table
  from the architecture doc, plus `User`/`AppRole` for auth.
- Auth: login/logout, signed session cookies, route protection (`src/proxy.ts` does an
  optimistic cookie check; `src/lib/auth.ts#getSession` does the real per-page check).
- A navigation shell (`src/app/(app)/layout.tsx`) and three proof pages reading live data:
  `/dashboard` (KPI counts), `/employees`, `/projects` — all read-only.
- `/admin/users` — visible only to `AppRole.ADMIN`, enforced server-side, not just hidden
  from the nav. This is the concrete demonstration that the RBAC gap is closed.
- `scripts/e2e-smoke.mjs` — a Playwright script exercising the full flow (unauth redirect →
  login → data pages → RBAC-gated admin page → logout → re-blocked). Run with
  `node scripts/e2e-smoke.mjs` against a running `npm run start`.

## Not yet built (later phases — see §0 of the architecture doc)

Master data CRUD, forecast/capacity input forms, the §9 dashboards as real charts, the §8
import pipeline, and the §7.4 what-if UI. The data model underneath all of them already
exists.
