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
  lookup tables (Project Status, Priority, Forecast Source, Adjustment Type, Job Role,
  etc.) — one page template serves all of them rather than 14 near-duplicate files.
  `Scenario` is deliberately **not** one of them, despite being scalar-looking at a glance —
  it carries a self-referential `baseScenarioId` (§7.4's "Baseline + adjustments" branching,
  see below) that `lookups.ts`'s scalar-only field types can't express, so it gets its own
  bespoke handling instead.
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
- `e2e-task-sheet.mjs` — exercises the MSP-shorthand Predecessors cell directly (including a
  task's start correctly shifting to right after its predecessor's finish, and a bad task
  number surfacing a clear inline error), the Owner team + Assigned to dropdowns (picking a
  team, adding two people scoped to it with independent percentages, confirming the second
  picker excludes whoever the first one already picked), and marking a task done
  rescheduling its successor.
- `e2e-my-tasks.mjs` — links the demo login to an employee (restored afterward either way),
  assigns them a task via the Assigned to picker, confirms it's listed on `/my-tasks`, marks
  it complete from there, and confirms the Gantt sheet reflects the same completion.

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
- The cross-project per-team rollup view (a team's total committed time across all its
  projects) is the natural companion read-only report to this entry grid — see below.

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
  (SVG elbow connectors), critical path in red, a "today" marker. Interactive: drag a bar's
  body to shift its start, or its right edge to resize it — see "Drag-to-resize /
  drag-to-move" below.
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
  lag), parsed by `src/lib/task-shorthand.ts` (pure, no DB access) and validated
  server-side — an unknown task number or a cycle-creating dependency surfaces as a clear
  inline error on the cell rather than silently failing.
- **Owner team** and **Assigned to** columns replace what was originally a typed Resources
  shorthand cell with actual dropdowns: `Task.ownerTeamId` (`prisma/schema.prisma`) picks a
  team, which narrows the Assigned to picker to that team's members only (no team chosen
  falls back to every employee). Assigned to supports multiple people per task — a "+ Add
  person" row adds another `<select>`, each already-picked person is excluded from the
  other rows' options so the same person can't be double-assigned, and each person gets
  their own independently-editable share of the work (1-100%, not required to sum to 100 —
  e.g. two people each doing their own 60%/40% slice of a task's total duration).
  `setTaskOwnerTeamAction`/`setTaskAssignmentsAction` (`src/app/actions/tasks.ts`) replace
  the assignment rows (`TaskAssignment.fte` stores each share) and recompute the schedule,
  same as every other sheet edit.
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

**What-if & scenarios (§7.4) — Phase 5 of the revised roadmap:**
- Scenarios are "Baseline + adjustments," not duplicated copies of the allocation table.
  `Scenario.baseScenarioId` (a self-relation that existed in the schema from the start but
  was never wired up until this phase) marks a scenario as a **branch** — it holds zero
  `ForecastAllocation`/`Capacity` rows of its own and reads its base scenario's rows at query
  time instead. `resolveScenarioSourceId` (`src/lib/scenario.ts`) is that resolution point;
  every `measures.ts` function that filters by `scenarioId` runs through it, so a branch
  scenario shows real numbers everywhere (Business/Team Overview, forecast accuracy, etc.),
  not just wherever adjustments happen to be wired in.
- **`/what-if`** (in the main nav) — for whichever scenario the header's scenario switcher
  currently has active. If it's a real base scenario (`Baseline`/`Budget`), the page leads
  with "Create a what-if scenario" (`createScenarioBranchAction`) rather than letting
  adjustments attach directly to it — a branch is one click, and it's what keeps a
  hypothetical from silently changing what every other viewer of `Baseline` sees. Once
  viewing a branch, the page shows that scenario's adjustments (add/delete) and a
  before/after Committed/Weighted/Stretch panel (`getDemandBridge` called twice, toggling
  `applyAdjustments`) — the same numbers Business Overview shows, not a separate copy,
  proving out §7.4's "every dashboard recalculates automatically" claim directly on the page
  where you're deciding whether to keep the adjustment.
- **`src/lib/whatif.ts`** — the resolver. Only **Delay**, **Cancel** and **Win** — the three
  `AdjustmentType`s the architecture doc gives concrete, computable resolution rules for —
  have any numeric effect: Cancel drops a project's allocation rows (optionally gated by an
  `effectiveDateKey`), Delay shifts their `dateKey` forward by `deltaWeeks × 7` days, Win
  forces a project's effective probability to 100% for weighted-demand math. `Recruitment
  Freeze` / `New Hire` / `Contractor Loss` / `Team Expansion` / `Team Reduction` remain fully
  creatable and visible on `/what-if` (they're still real decisions worth logging against a
  scenario) but have no numeric effect on any number — the schema (and the architecture doc
  itself) carries no headcount/FTE magnitude field for them, only `deltaWeeks`/`notes`.
  Wired into `getDemandBridge`/`getProjectDemand` (`src/lib/measures.ts`) via additive
  optional `{ scenarioId, applyAdjustments }` params — every existing call site is
  unaffected. `dateKeyToDate` (`src/lib/calendar.ts`) is the new inverse of `dateKeyFor`
  the Delay shift needed.
- **Delay's numeric effect is a documented no-op on today's dashboards** and covered by a
  guarded regression check in `e2e-whatif.mjs`, not silently ignored: `getDemandBridge`/
  `getProjectDemand` are scalar totals with no date breakdown, so shifting a `dateKey`
  doesn't change a sum. Delay's effect only shows up on calendarized views, and the two
  calendarized measures (`getMonthlyDemandVsCapacity`, `getUtilisationHeatmap`) have a
  separate, pre-existing gap: they only sum `ForecastAllocation` rows with `teamId` set, but
  all project-linked and task-driven rows set `employeeId`/`projectId` instead — so those two
  already exclude all project-linked demand today, regardless of what-if. Not fixed as part
  of this phase; flagged here for whoever picks up the cross-project rollup view next, since
  the same gap was found independently while researching that feature too.
- Entry forms (`/forecast`, `/capacity`) exclude branch scenarios from their own scenario
  dropdown (`baseScenarioId: null` added alongside the existing `isLocked: false` filter) —
  a branch's whole point is "base + adjustments only," so hand-entering rows directly under
  its own `scenarioId` would create an unresolvable override-vs-merge ambiguity.
- `src/app/actions/whatif.ts` — `createAdjustmentAction`/`deleteAdjustmentAction`, gated by
  `ADMIN`/`PMO` (matching `projects.ts` — a Cancel/Win/Delay call is a commercial decision
  about a project's trajectory, the same class of judgement call as editing a project's own
  `probabilityOverridePct`). `createScenarioBranchAction` (`src/app/actions/scenario.ts`)
  shares that gate.
- `scripts/check-whatif.mjs` — a standalone, no-server sanity check of the resolver's pure
  functions (same idea as `check-scheduling.mjs`), run with `npx tsx scripts/check-whatif.mjs`
  (plain `node --experimental-strip-types` won't resolve the `@/` alias `whatif.ts` uses for
  its calendar import, unlike `scheduling.ts`'s target which has zero imports).
  `scripts/e2e-whatif.mjs` branches a scenario, applies Cancel/Win/Delay against seeded
  sample projects, confirms Business Overview and Project Overview move accordingly (and
  that Delay doesn't), confirms the What-If page's own before/after panel agrees with the
  real dashboards, and cleans up directly via SQL afterward since there's no delete-scenario
  UI action (branch scenarios are meant to accumulate, not be torn down from the app itself).

**Cross-project team rollup:**
- **`/teams/[id]/rollup`** (linked from the Teams list and, when a team is selected, from
  Team Overview) — the natural companion to the per-project forecast grid: one team's
  committed hours summed across *every* project it's linked to, calendarised the same way
  (month/week columns, collapse-to-month). Read-only — hours are entered from each
  project's own forecast grid, never here.
- `src/lib/team-rollup.ts` — `getTeamRollup(teamId, scenarioId, months)` mirrors
  `getProjectForecastGrid` (`src/lib/forecast-grid.ts`) inverted: rows are projects instead
  of employees, sourced from `ProjectTeam` the other direction (`where: { teamId }`), hours
  summed via a join through `employee: { teamId }` — the fix for a gap two separate research
  passes this session found in `getUtilisationHeatmap`/`getMonthlyDemandVsCapacity`
  (`src/lib/measures.ts`): those two only sum `ForecastAllocation` rows with `teamId`
  directly set, but all project-linked and task-driven rows set `employeeId`/`projectId`
  instead, never `teamId`, so they silently exclude all project-linked demand. This new
  function does not inherit that gap. Reuses `ensureCalendarWeeksInRange` from
  `forecast-grid.ts` as-is for the column structure.
- Resolves the scenario id via `resolveScenarioSourceId` (§7.4) before querying, and runs
  fetched rows through `applyProjectAdjustments` (`src/lib/whatif.ts`) — **Cancel and Delay
  apply here, Win does not**. This is the first calendarized view in the app where Delay's
  date-shift is visually verifiable rather than a documented no-op on a scalar total (see
  the What-If section above). Win is skipped because this view has no probability dimension
  at all — it shows raw committed hours per project/week, the same as the project grid
  shows raw hours per employee/week, so there's nothing for a probability override to
  multiply.
- `src/components/team-rollup.tsx` — a new, self-contained read-only component, not an
  extension of `forecast-grid.tsx`. The two views' headers only overlap in ~25 lines of
  month-collapse markup; not worth a shared abstraction for one other caller, and
  `forecast-grid.tsx` is the one component here with real e2e coverage of its own
  edit/task-expand/team-add-remove behaviour that a shared component would sit upstream of.
  Hours only, no FTE/Hours toggle — FTE only makes sense where a per-row
  `standardWeeklyHours` denominator exists (true per-employee in the project grid); rows
  here are *projects*, which have none.
- `scripts/e2e-team-rollup.mjs` — picks two projects dynamically (not hardcoded names, so
  it survives reseeds), links the same team to both, confirms hours sum correctly across
  projects, confirms removing/re-adding a project's `ProjectTeam` link drops/restores its
  row without losing the underlying hours, then branches a what-if scenario and confirms
  Delay visibly shifts a project's row by the right number of weeks and Cancel zeroes it
  while an unrelated project stays untouched. Also self-cleans any pre-existing
  `ProjectTeam` links on the two projects it picks before starting, since earlier scripts
  in the same suite run (`e2e-gantt.mjs`, `e2e-task-sheet.mjs`, `e2e-my-tasks.mjs`) assign
  employees to tasks as part of their own tests, which auto-adds `ProjectTeam` rows as a
  legitimate side effect they don't themselves clean up — this test is self-sufficient
  against that regardless of run order.

**Drag-to-resize / drag-to-move (Gantt chart):**
- Drag a bar's body to shift its start, or its right edge to resize it — both directly on
  `/projects/[id]/gantt`'s chart, no separate edit step needed. This closes the last item
  from the original architecture-doc backlog (What-If and the team rollup, both above,
  were the other two).
- **Drag-to-move writes `Task.manualStartDate`, a field that already existed in the schema
  and was already fully handled by the CPM engine (`src/lib/scheduling.ts`'s
  `computeSchedule`) — it just never had a write path.** `manualStartDate` is a "no earlier
  than" floor: it pushes a task's early start later, but a dependency that would push it
  even later than the manual date always wins (`manualDateConflict: true` is set, surfaced
  in the bar's tooltip). Building this feature was mostly wiring up a field the scheduling
  engine was already designed to support — not inventing new semantics — via a new
  `setTaskManualStartDateAction` (`src/app/actions/tasks.ts`, same shape as every other
  action there; one action for both set and clear, `date: null` clears it).
- **Drag-to-resize reuses `setTaskDurationAction` verbatim** — the same action the task
  sheet's Duration cell already calls; no new action needed for it.
- `src/lib/gantt-drag.ts` — the two pure helpers behind the interaction:
  `pixelDeltaToCalendarDays` (pixel delta → calendar-day delta, matching the chart's own
  `PX_PER_DAY` positioning convention — raw calendar days, not working days) and
  `clampResizeDays` (floors a resize preview at 1 day, mirroring `setTaskDurationAction`'s
  own server-side rejection of shorter durations, so that rejection path stays unreachable
  via dragging).
- `src/components/gantt-chart.tsx` uses native Pointer Events (`onPointerDown` +
  `setPointerCapture`, no drag library) — the live preview during a drag is pure client
  state (no server call until drop); dependency-connector arrows intentionally stay static
  during the gesture and only refresh after the commit's `router.refresh()`, since
  recomputing them live would mean touching every bar's rect on every `pointermove` for a
  purely cosmetic improvement. No client-side role gating (matches every other edit
  surface in this app) — a non-editor's drop is rejected server-side like any other action,
  surfaced via the bar's existing tooltip.
- `scripts/check-scheduling.mjs` gained `manualStartDate` fixture cases (floor-wins,
  dependency-wins-with-conflict) — this code path had **zero test coverage** before, since
  every prior fixture used `manualStartDate: null`. `scripts/check-gantt-drag.mjs` is a new
  standalone check of the two pure helpers above. `scripts/e2e-gantt-drag.mjs` drives real
  drag gestures with Playwright's mouse API (`{ steps: N }` on the intermediate move, so
  real `pointermove` events fire) — resizes a marker task and cross-checks the task sheet's
  Duration cell agrees, moves it and confirms the date range shifts, then drags a
  dependent task's bar 10 days earlier and asserts the manual-start-date conflict tooltip
  appears — the first time that message (present in the code since the Gantt chart shipped)
  has ever been reachable.
- Fixed a related bug found while building this: the task sheet's Duration `<input>` used
  an uncontrolled `defaultValue`, so a duration changed from *outside* the sheet (i.e. by
  dragging on the chart) never visually updated the sheet's own cell — React doesn't re-sync
  `defaultValue` on a re-render of an already-mounted uncontrolled input. Fixed by keying
  the input on the value itself (`key={t.durationDays}`), forcing a remount whenever the
  server-provided duration actually changes.

## Not yet built (later phases — see §0 of the architecture doc)

Hardening (§16 Phase 9) hasn't started; formal UAT (Phase 10) needs real stakeholder
sign-off from Leadership/PMO/Finance/HR, which isn't something this build process can do on
its own.
