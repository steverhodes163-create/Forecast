# YASA Resource Forecasting — Web App

Phases 1–4 (Foundations, Master Data & Input, Dashboards, Actuals Import) of the platform described in
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
- **Recharts** for the §9 dashboard charts

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

**Phase 3 (Dashboards) — replaces the KPI-only `/dashboard` with real §9 dashboards:**
- `src/lib/measures.ts` — the calculation layer: the §7 DAX-equivalent formulas
  (Utilisation %, Available Hours, Committed/Weighted/Stretch Demand, headcount vs
  vacancy) as plain TypeScript functions, queried once and shared by every dashboard.
- **`/dashboard` (Business Overview)** — KPI cards, a Manhattan chart (demand vs capacity
  by month), a demand bridge waterfall (Committed → Weighted → Stretch), and a
  team × month utilisation heat map.
- **`/team-overview`** — utilisation trend line per team, headcount vs vacancy vs open
  recruitment pipeline.
- **`/project-overview`** — weighted demand by project (bar colour = RAG status), revenue
  and RAG summary.
- `prisma/seed.ts` note: `fact_Capacity`'s grain is monthly per the architecture doc — the
  seed writes one row per team per month (via the shared `buildCalendarDateRow` in
  `src/lib/calendar.ts`), not one per week, so monthly aggregates aren't accidentally
  inflated by summing several weeks' worth of the same figures.

**Phase 4 (Actuals Import) — the §8 Landing → Staging → Conforming → Load pipeline:**
- `Employee.employeeNumber` / `Project.projectCode` — natural keys added specifically so
  imports can match "by number, not name" as §8 requires; the original schema had no such
  field, so this was a genuine gap closed here, not a pre-planned column.
- `ImportException` — unmatched rows are never dropped; they're persisted here with the
  row number, raw data and a reason, and reviewable per batch. The `OUT_ImportExceptions`
  queue from §4/§8.
- `src/lib/imports.ts` — parses a CSV (`csv-parse`), conforms each row against
  Employee/Project/ForecastSource by natural key, and loads matched rows into
  `fact_ActualAllocation` tagged with a new `ImportBatch` (audit trail: who/when/how many).
- **`/imports`** — upload a timesheet CSV (template downloadable from the page), see batch
  history with row/exception counts.
- **`/imports/[id]`** — a batch's loaded actuals and its exceptions, side by side.
- `getForecastAccuracy()` in `src/lib/measures.ts` — §8's "Actual vs Forecast, Forecast
  Accuracy, Variance," surfaced as a chart on the Business Overview dashboard once any
  actuals exist (hidden otherwise, rather than showing an always-empty chart).
- Role-gated: import requires `ADMIN`/`PMO`/`FINANCE`.

**Testing** — `scripts/e2e-*.mjs`, Playwright scripts run against a live `npm run start`:
- `e2e-smoke.mjs` — auth flow: unauth redirect → login → data pages → RBAC-gated admin
  page → logout → re-blocked.
- `e2e-employee.mjs`, `e2e-project.mjs` — full create/edit/delete round trip.
- `e2e-org-lookups.mjs` — a lookup table's create/edit/delete plus Departments/Teams render.
- `e2e-forecast.mjs` — creates an allocation in all three planning modes, verifies each
  renders correctly, deletes one.
- `e2e-capacity.mjs` — verifies the upsert-not-duplicate behaviour and the live Available
  Hours calculation before and after an update.
- `e2e-dashboard.mjs` — confirms the Business Overview's charts and heat map actually
  render (checks for recharts SVG elements and heat map cells, not just page 200s).
- `e2e-imports.mjs` — uploads a CSV with one valid row and two intentionally-bad rows,
  confirms the valid row loads and both bad rows land in the exceptions queue with the
  right reasons.

Run any of them with `node scripts/e2e-<name>.mjs` while `npm run start` (or `npm run dev`)
is serving on port 3100. `scripts/screenshots.mjs` captures every main screen to
`.screenshots/` (gitignored) if you want a quick visual check without running the app
yourself.

## Not yet built (later phases — see §0 of the architecture doc)

The §7.4 what-if UI (scenario adjustments — the data model for it, `ScenarioAdjustment`,
already exists). Hardening and UAT (§16 Phase 9-10) haven't started.
