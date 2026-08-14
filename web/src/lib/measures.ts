// The calculation layer (§7 of the architecture doc). In the Excel design this
// was a DAX measure catalogue; here it's the same formulas as plain server-side
// functions, queried once and reused by every dashboard — no dashboard computes
// its own copy of "Utilisation %" or "Weighted Demand".
import "server-only";
import { db } from "@/lib/db";
import { buildCalendarDateRow } from "@/lib/calendar";
import { getActiveScenarioId, resolveScenarioSourceId } from "@/lib/scenario";
import { applyProjectAdjustments, effectiveProbabilityPct, getScenarioAdjustments } from "@/lib/whatif";

export function monthKeyOf(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/** The next N month buckets starting with the current month, as "YYYY-MM" keys. */
export function upcomingMonthKeys(count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** The past N month buckets ending with the current month, oldest first. */
export function recentMonthKeys(count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

// §7.2: Available Hours = Standard − (Training + Shutdown + Holiday + InternalMeeting + BAUAllowance + ManagementOverhead)
function availableHoursOf(c: {
  standardHours: unknown;
  trainingHours: unknown;
  businessShutdownHours: unknown;
  holidayHours: unknown;
  internalMeetingHours: unknown;
  bauAllowanceHours: unknown;
  managementOverheadHours: unknown;
}): number {
  const n = (v: unknown) => Number(v);
  return (
    n(c.standardHours) -
    (n(c.trainingHours) +
      n(c.businessShutdownHours) +
      n(c.holidayHours) +
      n(c.internalMeetingHours) +
      n(c.bauAllowanceHours) +
      n(c.managementOverheadHours))
  );
}

export type MonthlyDemandCapacity = {
  monthKey: string;
  label: string;
  demandHours: number;
  availableHours: number;
};

/**
 * §7.2 Utilisation / Headroom inputs: booked (demand) hours vs available
 * (capacity) hours per month, optionally scoped to one team. Demand is
 * summed from weekly fact_ForecastAllocation rows; capacity is read directly
 * from monthly fact_Capacity rows — the two grains are joined on "YYYY-MM".
 */
export async function getMonthlyDemandVsCapacity(opts: { months: number; teamId?: number }): Promise<MonthlyDemandCapacity[]> {
  const activeScenarioId = await getActiveScenarioId();
  const monthKeys = upcomingMonthKeys(opts.months);
  if (!activeScenarioId) return monthKeys.map((k) => ({ monthKey: k, label: monthLabel(k), demandHours: 0, availableHours: 0 }));
  const scenarioId = await resolveScenarioSourceId(activeScenarioId);

  const [allocations, capacities] = await Promise.all([
    db.forecastAllocation.findMany({
      where: { scenarioId, ...(opts.teamId ? { teamId: opts.teamId } : {}) },
      select: { dateKey: true, hours: true },
    }),
    db.capacity.findMany({
      where: { scenarioId, ...(opts.teamId ? { teamId: opts.teamId } : {}) },
      select: {
        dateKey: true,
        standardHours: true,
        trainingHours: true,
        businessShutdownHours: true,
        holidayHours: true,
        internalMeetingHours: true,
        bauAllowanceHours: true,
        managementOverheadHours: true,
      },
    }),
  ]);

  const demandByMonth = new Map<string, number>();
  for (const a of allocations) {
    const k = monthKeyOf(a.dateKey);
    demandByMonth.set(k, (demandByMonth.get(k) ?? 0) + Number(a.hours));
  }
  const availableByMonth = new Map<string, number>();
  for (const c of capacities) {
    const k = monthKeyOf(c.dateKey);
    availableByMonth.set(k, (availableByMonth.get(k) ?? 0) + availableHoursOf(c));
  }

  return monthKeys.map((k) => ({
    monthKey: k,
    label: monthLabel(k),
    demandHours: Math.round((demandByMonth.get(k) ?? 0) * 10) / 10,
    availableHours: Math.round((availableByMonth.get(k) ?? 0) * 10) / 10,
  }));
}

export type TeamMonthUtilisation = {
  teamId: number;
  teamName: string;
  months: { monthKey: string; label: string; utilisationPct: number | null }[];
};

/** Utilisation % (§7.2) per team, per month — the heat map's data. */
export async function getUtilisationHeatmap(months: number, opts?: { teamId?: number }): Promise<TeamMonthUtilisation[]> {
  const activeScenarioId = await getActiveScenarioId();
  const monthKeys = upcomingMonthKeys(months);
  const teams = await db.team.findMany({
    where: opts?.teamId ? { id: opts.teamId } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  if (!activeScenarioId) {
    return teams.map((t) => ({ teamId: t.id, teamName: t.name, months: monthKeys.map((k) => ({ monthKey: k, label: monthLabel(k), utilisationPct: null })) }));
  }
  const scenarioId = await resolveScenarioSourceId(activeScenarioId);

  const [allocations, capacities] = await Promise.all([
    db.forecastAllocation.findMany({
      where: opts?.teamId
        ? { scenarioId, teamId: opts.teamId }
        : { scenarioId, teamId: { not: null } },
      select: { dateKey: true, teamId: true, hours: true },
    }),
    db.capacity.findMany({
      where: { scenarioId, ...(opts?.teamId ? { teamId: opts.teamId } : {}) },
      select: {
        dateKey: true,
        teamId: true,
        standardHours: true,
        trainingHours: true,
        businessShutdownHours: true,
        holidayHours: true,
        internalMeetingHours: true,
        bauAllowanceHours: true,
        managementOverheadHours: true,
      },
    }),
  ]);

  const demandKey = (teamId: number, monthKey: string) => `${teamId}::${monthKey}`;
  const demand = new Map<string, number>();
  for (const a of allocations) {
    if (a.teamId == null) continue;
    const k = demandKey(a.teamId, monthKeyOf(a.dateKey));
    demand.set(k, (demand.get(k) ?? 0) + Number(a.hours));
  }
  const available = new Map<string, number>();
  for (const c of capacities) {
    const k = demandKey(c.teamId, monthKeyOf(c.dateKey));
    available.set(k, (available.get(k) ?? 0) + availableHoursOf(c));
  }

  return teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    months: monthKeys.map((mk) => {
      const avail = available.get(demandKey(t.id, mk));
      const booked = demand.get(demandKey(t.id, mk)) ?? 0;
      return {
        monthKey: mk,
        label: monthLabel(mk),
        utilisationPct: avail && avail > 0 ? Math.round((booked / avail) * 1000) / 10 : null,
      };
    }),
  }));
}

export type DemandBridge = { committedHours: number; weightedHours: number; stretchHours: number };

/**
 * §7.1 Committed / Weighted / Stretch Demand, project-linked allocations
 * only. `scenarioId`/`applyAdjustments` let the What-If page (src/app/(app)/
 * what-if/page.tsx) compute a before/after comparison for the same scenario
 * -- every other caller just gets the active scenario with adjustments
 * applied, unchanged from before §7.4.
 */
export async function getDemandBridge(opts?: { teamId?: number; scenarioId?: number; applyAdjustments?: boolean }): Promise<DemandBridge> {
  const requestedScenarioId = opts?.scenarioId ?? (await getActiveScenarioId());
  if (!requestedScenarioId) return { committedHours: 0, weightedHours: 0, stretchHours: 0 };
  const scenarioId = await resolveScenarioSourceId(requestedScenarioId);
  const applyAdjustments = opts?.applyAdjustments ?? true;

  const [allocations, adjustments] = await Promise.all([
    db.forecastAllocation.findMany({
      where: { scenarioId, projectId: { not: null }, ...(opts?.teamId ? { teamId: opts.teamId } : {}) },
      select: {
        projectId: true,
        dateKey: true,
        hours: true,
        project: {
          select: {
            probabilityOverridePct: true,
            projectStatus: { select: { name: true, defaultProbabilityPct: true } },
          },
        },
      },
    }),
    applyAdjustments ? getScenarioAdjustments(requestedScenarioId) : Promise.resolve([]),
  ]);

  const projectMeta = new Map(allocations.map((a) => [a.projectId!, a.project]));
  const adjustedRows = applyProjectAdjustments(
    allocations.map((a) => ({ projectId: a.projectId, dateKey: a.dateKey, hours: Number(a.hours) })),
    adjustments
  );

  let committedHours = 0;
  let weightedHours = 0;
  let stretchHours = 0;
  for (const row of adjustedRows) {
    const status = projectMeta.get(row.projectId!)?.projectStatus;
    if (!status || status.name === "Cancelled") continue;
    const baseProbabilityPct = Number(projectMeta.get(row.projectId!)?.probabilityOverridePct ?? status.defaultProbabilityPct);
    const probability = effectiveProbabilityPct(baseProbabilityPct, row.projectId, adjustments) / 100;
    stretchHours += row.hours;
    weightedHours += row.hours * probability;
    if (status.name === "Committed" || status.name === "Won") committedHours += row.hours;
  }

  return {
    committedHours: Math.round(committedHours * 10) / 10,
    weightedHours: Math.round(weightedHours * 10) / 10,
    stretchHours: Math.round(stretchHours * 10) / 10,
  };
}

export type TeamHeadcount = {
  teamId: number;
  teamName: string;
  budgeted: number;
  actual: number;
  vacancies: number;
  openRequisitions: number;
};

/** Current-month headcount vs vacancy vs open recruitment pipeline, per team. */
export async function getTeamHeadcount(opts?: { teamId?: number }): Promise<TeamHeadcount[]> {
  const activeScenarioId = await getActiveScenarioId();
  const scenarioId = activeScenarioId ? await resolveScenarioSourceId(activeScenarioId) : null;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dateKey = buildCalendarDateRow(monthStart).dateKey;

  const teams = await db.team.findMany({
    where: opts?.teamId ? { id: opts.teamId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      capacities: scenarioId ? { where: { scenarioId, dateKey } } : false,
      recruitments: { where: { NOT: { recruitmentStatus: { name: { in: ["Cancelled", "Started"] } } } } },
    },
  });

  return teams.map((t) => {
    const cap = t.capacities?.[0];
    return {
      teamId: t.id,
      teamName: t.name,
      budgeted: cap ? Number(cap.budgetedHeadcount) : 0,
      actual: cap ? Number(cap.actualHeadcount) : 0,
      vacancies: cap ? Number(cap.vacancies) : 0,
      openRequisitions: t.recruitments.length,
    };
  });
}

export type ProjectDemand = { projectId: number; projectName: string; weightedHours: number; revenueForecast: number | null; ragStatus: string | null };

/**
 * Weighted demand and revenue per project, for the Project Overview chart.
 * `scenarioId`/`applyAdjustments` -- see getDemandBridge's doc comment.
 * A scenario-level Cancel zeroes a project's hours here rather than
 * removing it from the list -- its real `projectStatus` (excluded above via
 * the `NOT: {name: "Cancelled"}` filter) is a different thing from a
 * scenario's hypothetical override, and the project should stay visible at
 * zero so a before/after comparison has something to show.
 */
export async function getProjectDemand(opts?: {
  customerId?: number;
  projectStatusId?: number;
  scenarioId?: number;
  applyAdjustments?: boolean;
}): Promise<ProjectDemand[]> {
  const requestedScenarioId = opts?.scenarioId ?? (await getActiveScenarioId());
  if (!requestedScenarioId) return [];
  const scenarioId = await resolveScenarioSourceId(requestedScenarioId);
  const applyAdjustments = opts?.applyAdjustments ?? true;

  const [projects, adjustments] = await Promise.all([
    db.project.findMany({
      where: {
        NOT: { projectStatus: { name: "Cancelled" } },
        ...(opts?.customerId ? { customerId: opts.customerId } : {}),
        ...(opts?.projectStatusId ? { projectStatusId: opts.projectStatusId } : {}),
      },
      select: {
        id: true,
        name: true,
        revenueForecast: true,
        ragStatus: true,
        probabilityOverridePct: true,
        projectStatus: { select: { defaultProbabilityPct: true } },
        forecastAllocations: { where: { scenarioId }, select: { dateKey: true, hours: true } },
      },
      orderBy: { name: "asc" },
    }),
    applyAdjustments ? getScenarioAdjustments(requestedScenarioId) : Promise.resolve([]),
  ]);

  return projects.map((p) => {
    const baseProbabilityPct = Number(p.probabilityOverridePct ?? p.projectStatus.defaultProbabilityPct);
    const probability = effectiveProbabilityPct(baseProbabilityPct, p.id, adjustments) / 100;
    const rows = applyProjectAdjustments(
      p.forecastAllocations.map((a) => ({ projectId: p.id, dateKey: a.dateKey, hours: Number(a.hours) })),
      adjustments
    );
    const hours = rows.reduce((sum, a) => sum + a.hours, 0);
    return {
      projectId: p.id,
      projectName: p.name,
      weightedHours: Math.round(hours * probability * 10) / 10,
      revenueForecast: p.revenueForecast ? Number(p.revenueForecast) : null,
      ragStatus: p.ragStatus,
    };
  });
}

export type MonthlyAccuracy = {
  monthKey: string;
  label: string;
  actualHours: number;
  forecastHours: number;
  varianceHours: number;
  accuracyPct: number | null;
};

/**
 * §8: "Automatically calculate Actual vs Forecast, Forecast Accuracy, Variance."
 * Actual comes from fact_ActualAllocation (the import pipeline, §8); forecast
 * from fact_ForecastAllocation on the default scenario. Only months where a
 * forecast existed get an accuracy % — an actual with no forecast to compare
 * against isn't an accuracy result, it's just unplanned work.
 */
export async function getForecastAccuracy(months: number): Promise<MonthlyAccuracy[]> {
  const activeScenarioId = await getActiveScenarioId();
  const scenarioId = activeScenarioId ? await resolveScenarioSourceId(activeScenarioId) : null;
  const monthKeys = recentMonthKeys(months);

  const [actuals, forecasts] = await Promise.all([
    db.actualAllocation.findMany({ select: { dateKey: true, actualHours: true } }),
    scenarioId
      ? db.forecastAllocation.findMany({ where: { scenarioId }, select: { dateKey: true, hours: true } })
      : Promise.resolve([]),
  ]);

  const actualByMonth = new Map<string, number>();
  for (const a of actuals) {
    const k = monthKeyOf(a.dateKey);
    actualByMonth.set(k, (actualByMonth.get(k) ?? 0) + Number(a.actualHours));
  }
  const forecastByMonth = new Map<string, number>();
  for (const f of forecasts) {
    const k = monthKeyOf(f.dateKey);
    forecastByMonth.set(k, (forecastByMonth.get(k) ?? 0) + Number(f.hours));
  }

  return monthKeys.map((k) => {
    const actualHours = Math.round((actualByMonth.get(k) ?? 0) * 10) / 10;
    const forecastHours = Math.round((forecastByMonth.get(k) ?? 0) * 10) / 10;
    const varianceHours = Math.round((actualHours - forecastHours) * 10) / 10;
    const accuracyPct = forecastHours > 0 ? Math.round((100 - (Math.abs(varianceHours) / forecastHours) * 100) * 10) / 10 : null;
    return { monthKey: k, label: monthLabel(k), actualHours, forecastHours, varianceHours, accuracyPct };
  });
}

/** Whether any actuals have ever been imported — dashboards use this to decide whether to show the accuracy widget at all. */
export async function hasAnyActuals(): Promise<boolean> {
  const count = await db.actualAllocation.count();
  return count > 0;
}
