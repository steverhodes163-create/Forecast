# YASA Resource Forecasting — Web App

Phases 1–2 (Foundations, Master Data & Input) of the platform described in
`../docs/Solution-Architecture.md` (see §0 Platform Decision Addendum for why this is a
web app rather than an Excel workbook, and what does/doesn't change from the original
architecture).

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

## What's here

**Phase 1 (Foundations):**
- The full relational schema (`prisma/schema.prisma`) — every `dim_`/`fact_`/`brg_` table
  from the architecture doc, plus `User`/`AppRole` for auth.
- Auth: login/logout, signed session cookies, route protection (`src/proxy.ts` does an
  optimistic cookie check; `src/lib/auth.ts#getSession` does the real per-page check).
- `/admin/users` — visible only to `AppRole.ADMIN`, enforced server-side, not just hidden
  from the nav. The concrete demonstration that the RBAC gap flagged in §17 is closed.

**Phase 2 (Master Data & Input) — replaces the `MST_`/`INP_` Excel sheets:**
- Full CRUD (create/edit/delete) for **Employees**, **Projects**, **Departments**, **Teams**.
- Config-driven CRUD (`src/lib/lookups.ts` + `/settings/[table]`) for the 14 scalar-only
  lookup tables (Project Status, Priority, Forecast Source, Scenario, Job Role, etc.) — one
  page template serves all of them rather than 14 near-duplicate files.
- **`/forecast`** — `fact_ForecastAllocation` input supporting all three planning modes
  (Team / Employee / Skill) from §7 on one form, one table, one reporting layer.
- **`/capacity`** — `fact_Capacity` input (upsert per team/scenario/month) with §7.2's
  Available Hours computed live in the list, not stored.
- Role-gated: employee/department/team edits require `ADMIN`/`HR`; project edits require
  `ADMIN`/`PMO`; forecast/capacity entry requires `ADMIN`/`PMO`/`ENGINEERING_LEAD`
  (`requireEditor()` in each `src/app/actions/*.ts` file).

**Testing** — `scripts/e2e-*.mjs`, Playwright scripts run against a live `npm run start`:
- `e2e-smoke.mjs` — auth flow: unauth redirect → login → data pages → RBAC-gated admin
  page → logout → re-blocked.
- `e2e-employee.mjs`, `e2e-project.mjs` — full create/edit/delete round trip.
- `e2e-org-lookups.mjs` — a lookup table's create/edit/delete plus Departments/Teams render.
- `e2e-forecast.mjs` — creates an allocation in all three planning modes, verifies each
  renders correctly, deletes one.
- `e2e-capacity.mjs` — verifies the upsert-not-duplicate behaviour and the live Available
  Hours calculation before and after an update.

Run any of them with `node scripts/e2e-<name>.mjs` while `npm run start` (or `npm run dev`)
is serving on port 3100.

## Not yet built (later phases — see §0 of the architecture doc)

The §9 dashboards as real charts (only KPI counts exist so far on `/dashboard`), the §8
import pipeline, and the §7.4 what-if UI. The data model and the input screens underneath
all of them already exist.
