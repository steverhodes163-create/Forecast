# YASA Resource Forecasting — Web App

Phases 1–4 (Foundations, Master Data & Input, Dashboards, Actuals Import) plus a global
scenario switcher, dashboard filters, a calendarised per-project forecast grid, an
MSP-style task-driven Gantt chart with critical path scheduling, and self-service task
completion ("My Tasks") that feeds back into the schedule, of the platform described in
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

Demo login: `steve@yasa.local` / `steve` (seeded — change/remove before any non-local use).

To reseed from a clean slate, use `npx prisma migrate reset` (destructive — drops and
recreates the local dev database; never run against a shared/production database).

**Deployed (Vercel) database stays in sync automatically:** the `build` script is
`prisma migrate deploy && next build`, so every deployment applies any pending migrations
against whichever `DATABASE_URL` that environment has configured before building — the
standard pattern for Prisma + CI/CD. This is what previously required manually opening a
GitHub Codespace and running `prisma migrate deploy` by hand after each schema change; now
a normal push (or clicking Redeploy in Vercel) does it. If a migration fails, the whole
build fails loudly in the Vercel build log instead of deploying successfully and then
breaking pages at runtime — a deliberate trade, since a build that won't ship at all is a
much clearer signal than random pages 500ing in production.

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
- `e2e-scenario.mjs`, `e2e-filters.mjs` — the global scenario switcher (including the
  locked-scenario fallback on entry forms) and each dashboard's filters.
- `e2e-forecast-grid.mjs` — add a team to a project's grid, enter marker hours for two
  members, confirms the team subtotal sums correctly, the FTE/Hours toggle changes the
  display, collapsing a month hides its week columns, and removing a team preserves its
  underlying hours (they reappear when the team is re-added).
- `e2e-gantt.mjs` — builds a 3-task dependency chain via the task sheet, confirms all three
  render as critical, confirms the chart draws dependency connectors, confirms a
  cycle-creating dependency is rejected with a clear error, and cleans up.
- `e2e-task-sheet.mjs` — exercises the MSP-shorthand cells directly: Predecessors and
  Resources parsing (including a task's start correctly shifting to right after its
  predecessor's finish), a bad task number and an unknown employee name each surfacing a
  clear inline error, and marking a task done rescheduling its successor.
- `e2e-my-tasks.mjs` — links the demo login to an employee (restored afterward either way),
  assigns them a task, confirms it's listed on `/my-tasks`, marks it complete from there, and
  confirms the Gantt sheet reflects the same completion.

Run any of them with `node scripts/e2e-<name>.mjs` while `npm run start` (or `npm run dev`)
is serving on port 3100. `scripts/screenshots.mjs` captures every main screen to
`.screenshots/` (gitignored) if you want a quick visual check without running the app
yourself. `scripts/check-scheduling.mjs` is a standalone (no server needed) sanity check of
the CPM scheduling math — run with `node --experimental-strip-types scripts/check-scheduling.mjs`.

**Global scenario switcher & dashboard filters:**
- `src/lib/scenario.ts` / `src/app/actions/scenario.ts` / `src/components/scenario-switcher.tsx`
  — a cookie-based active scenario (`yasa_scenario_id`), switchable from a dropdown in the
  app header on every page, falling back to the "Baseline" scenario if unset/invalid. Entry
  forms (Forecast, Capacity) default their own scenario field to the active scenario.
  Locked scenarios are excluded from those entry forms but selectable in the switcher for
  reporting. The switcher's own `<select>` is named `globalScenarioId` (not `scenarioId`)
  specifically so it never collides with the identically-named field inside the
  Forecast/Capacity entry forms rendered on the same page.
- `src/components/dashboard-filter-bar.tsx` — a reusable GET-form filter bar (URL search
  params, no client state) used by Business Overview (Team), Team Overview (Team), and
  Project Overview (Customer, Status). `getUtilisationHeatmap`, `getDemandBridge`,
  `getTeamHeadcount`, `getProjectDemand` in `src/lib/measures.ts` all accept optional filter
  args.
- `e2e-scenario.mjs`, `e2e-filters.mjs` — cover switching scenarios (including the locked-
  scenario fallback on entry forms) and each dashboard's filters.

**Calendarised forecast grid (§7 employee-mode entry, per project):**
- **`/projects/[id]/forecast`** (linked from the Projects list) — a spreadsheet-style view
  for entering a whole project's staffing plan in one place instead of one row at a time via
  `/forecast`: teams down the rows (expandable to their members), months across the columns
  (expandable to their weeks). Team and month values are always computed rollups of their
  members/weeks — never separately entered — matching the "Mech Eng 0.9 = Dave 0.2 + Harry
  0.3 + Gary 0.4" style of a manual planning spreadsheet.
- `ProjectTeam` (`prisma/schema.prisma`) — a new bridge table recording which teams are "on"
  a project's grid, independent of whether any hours exist yet, so a newly-added team shows
  all its members as blank rows ready for input rather than requiring an existing allocation
  first. Removing a team from the grid only deletes this marker row — any hours already
  entered stay in `ForecastAllocation` and reappear if the team is re-added.
- A new compound unique constraint on `ForecastAllocation` (`@@unique([scenarioId,
  employeeId, projectId, dateKey, resourceTypeId, forecastSourceId], name: "gridCell")`)
  gives each grid cell a stable identity to upsert against, the same pattern `Capacity`
  already used for its team/scenario/month upsert. It's scoped by `resourceTypeId` +
  `forecastSourceId` (always the seeded "Employee"/"Project" pair for grid writes) so it
  never collides with — or overwrites — a manually-entered row logged against a different
  source (e.g. "Annual Leave") for the same employee/week.
- `src/lib/forecast-grid.ts` — `ensureCalendarWeeksInRange` generates the month/week column
  structure for a rolling window and lazily ensures the underlying `CalendarDate` rows exist
  (same idea as the Capacity form's single-row version, generalised to a range); `getProjectForecastGrid`
  loads a project's teams → members and their hours into that structure.
- `src/components/forecast-grid.tsx` — the grid itself. Edits save per cell on blur (no
  separate "Save" step); an FTE/Hours toggle converts every cell through each employee's own
  `standardWeeklyHours` (hours are always what's stored — FTE is display-only, computed on
  the fly); only the finest visible grain is ever editable — a collapsed month or a team row
  is a read-only sum, exactly like Excel's "roll up, don't duplicate" convention.
- The grid has a third row level for task-driven hours (see below) — expand an employee with
  a ▸ toggle to see the tasks generating their numbers. Weeks a task covers become read-only
  (edit the task, not the cell); weeks with no task keep today's direct-entry behaviour.
- Not built yet: a cross-project *per-team* rollup view (a team's total committed time across
  all its projects) — the natural companion read-only report once this entry grid is
  established.

**Task-driven Gantt chart with critical path (§ task-driven forecasting, per project):**
- **`/projects/[id]/gantt`** (linked from the Projects list and cross-linked from the
  forecast grid) — a project's task plan: name, duration (working days), Finish-to-Start
  dependencies (with optional lag), and per-task employee assignments (FTE share). A real
  Critical Path Method (CPM) engine computes each task's schedule and highlights the
  critical path in red, same convention as MS Project.
- `Task` / `TaskDependency` / `TaskAssignment` (`prisma/schema.prisma`) — the task graph,
  plus a nullable `taskId` on `ForecastAllocation` tagging which rows were generated from a
  task versus typed directly into the grid (this is exactly the extensibility hook flagged,
  but deliberately not built, when the grid shipped).
- `src/lib/scheduling.ts` — the CPM engine as pure functions (`computeSchedule`: forward/
  backward pass giving early/late start-finish, slack, and `isCritical`; `weeklyHoursForTask`:
  prorates a task's hours into whichever week they partially overlap). No DB access, verified
  standalone via `scripts/check-scheduling.mjs` (a pure chain, a parallel branch with slack,
  the proration math, and a completed-task reschedule case — see below).
- `src/lib/task-service.ts` — `recomputeProjectSchedule(projectId)` re-runs the CPM engine and
  regenerates every task's `taskId`-tagged `ForecastAllocation` rows against whichever
  scenario is currently active, called after every task/dependency/assignment change. If an
  assignee's team was never added to the project's forecast grid, it's added automatically —
  tasks are meant to drive the grid, so the grid always shows what's driving it.
- `src/components/gantt-chart.tsx` — bars positioned by computed dates, dependency arrows
  (SVG elbow connectors), critical path in red, a "today" marker. **Read-only — edit dates via
  the task sheet below it, not by dragging the chart.** Drag-to-resize is an explicit,
  confirmed-with-the-user follow-up phase once this foundation (data model, CPM engine, and
  correct rendering) is proven out, not a cut corner.
- Cycle prevention: adding a dependency that would close a loop is rejected server-side
  (BFS over the existing graph) with a clear error, before anything is written.
- A task's schedule is scenario-independent (dates/durations/dependencies don't vary by
  scenario), but the *hours it writes* go into whichever scenario is active when a task is
  saved — a "Recalculate for current scenario" button on the Gantt page re-generates them
  for the scenario you're currently viewing, without changing anything about the task itself.

**MSP-style task sheet:**
- The Gantt page's task list is a single inline-editable spreadsheet
  (`src/components/task-sheet.tsx`), not a separate add/edit form — matching Microsoft
  Project's own task-sheet-drives-everything model. Every cell saves on blur; a blank row at
  the bottom adds a new task by typing its name.
- **Predecessors** column: MSP-style shorthand — a comma-separated list of task numbers,
  optionally with a lag, e.g. `1,3+2d` (depends on tasks #1 and #3, the latter with a 2-day
  lag). **Resources** column: comma-separated names, optionally with an FTE share, e.g.
  `Alex Whitfield[50%]` (defaults to 100%). Both are parsed by
  `src/lib/task-shorthand.ts` (pure, no DB access) and validated server-side — an unknown
  task number, an unknown employee name, or a cycle-creating dependency all surface as a
  clear inline error on the cell rather than silently failing.
- This replaced the earlier form-based "Add task" card and its separate
  `/gantt/tasks/[id]/edit` page entirely, per explicit confirmation this app's Gantt should
  behave like MSP's own UI — not interoperate with real Microsoft Project files or Project
  Online/Project for the Web, which nothing here attempts.

**My Tasks — self-service completion, feeding back into the schedule:**
- **`/my-tasks`** (in the main nav, visible to everyone) — every task the signed-in user's
  linked `Employee` record (`User.employeeId`) is personally assigned to, across every
  project, with duration, computed due date, and a Done checkbox. Empty-state if the account
  isn't linked to an employee (true for most ADMIN/PMO accounts, by design).
- `Task.completedAt` — when a task is marked done (from either `/my-tasks` or the Gantt
  sheet's own Done column), this captures the *actual* finish date. `computeSchedule` then
  fixes that task's contribution to the schedule to the real finish instead of the planned
  one, so anything waiting on it reschedules from reality — finished early, its successor
  moves up; finished late, its successor slips too.
- Two gates, one shared mutation (`setTaskCompletion` in `src/lib/task-service.ts`): the
  Gantt sheet's Done column requires the same `ADMIN`/`PMO`/`ENGINEERING_LEAD` role as every
  other edit there; `/my-tasks`' own checkbox instead requires "the caller is assigned to
  this task" (`src/app/actions/my-tasks.ts`) — any employee can mark their own work done
  without needing edit rights over the plan's structure.

## Not yet built (later phases — see §0 of the architecture doc)

The §7.4 what-if UI (scenario adjustments — the data model for it, `ScenarioAdjustment`,
already exists), the cross-project per-team rollup view, and drag-to-resize on the Gantt
chart (Phase B of task-driven forecasting) — all noted above. Hardening and UAT (§16
Phase 9-10) haven't started.
