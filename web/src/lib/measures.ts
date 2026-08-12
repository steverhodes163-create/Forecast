// The calculation layer (§7 of the architecture doc). In the Excel design this
// was a DAX measure catalogue; here it's the same formulas as plain server-side
// functions, queried once and reused by every dashboard — no dashboard computes
// its own copy of "Utilisation %" or "Weighted Demand".
import "server-only";
import { db } from "@/lib/db";
import { buildCalendarDateRow } from "@/lib/calendar";

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

async function defaultScenarioId(): Promise<number | null> {
  const scenario =
    (await db.scenario.findFirst({ where: { name: "Baseline" } })) ??
    (await db.scenario.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }));
  return scenario?.id ?? null;
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
  const scenarioId = await defaultScenarioId();
  const monthKeys = upcomingMonthKeys(opts.months);
  if (!scenarioId) return monthKeys.map((k) => ({ monthKey: k, label: monthLabel(k), demandHours: 0, availableHours: 0 }));

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
export async function getUtilisationHeatmap(months: number): Promise<TeamMonthUtilisation[]> {
  const scenarioId = await defaultScenarioId();
  const monthKeys = upcomingMonthKeys(months);
  const teams = await db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (!scenarioId) {
    return teams.map((t) => ({ teamId: t.id, teamName: t.name, months: monthKeys.map((k) => ({ monthKey: k, label: monthLabel(k), utilisationPct: null })) }));
  }

  const [allocations, capacities] = await Promise.all([
    db.forecastAllocation.findMany({ where: { scenarioId, teamId: { not: null } }, select: { dateKey: true, teamId: true, hours: true } }),
    db.capacity.findMany({
      where: { scenarioId },
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

/** §7.1 Committed / Weighted / Stretch Demand, project-linked allocations only. */
export async function getDemandBridge(): Promise<DemandBridge> {
  const scenarioId = await defaultScenarioId();
  if (!scenarioId) return { committedHours: 0, weightedHours: 0, stretchHours: 0 };

  const allocations = await db.forecastAllocation.findMany({
    where: { scenarioId, projectId: { not: null } },
    select: {
      hours: true,
      project: {
        select: {
          probabilityOverridePct: true,
          projectStatus: { select: { name: true, defaultProbabilityPct: true } },
        },
      },
    },
  });

  let committedHours = 0;
  let weightedHours = 0;
  let stretchHours = 0;
  for (const a of allocations) {
    const status = a.project?.projectStatus;
    if (!status || status.name === "Cancelled") continue;
    const hours = Number(a.hours);
    const probability = Number(a.project?.probabilityOverridePct ?? status.defaultProbabilityPct) / 100;
    stretchHours += hours;
    weightedHours += hours * probability;
    if (status.name === "Committed" || status.name === "Won") committedHours += hours;
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
export async function getTeamHeadcount(): Promise<TeamHeadcount[]> {
  const scenarioId = await defaultScenarioId();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dateKey = buildCalendarDateRow(monthStart).dateKey;

  const teams = await db.team.findMany({
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

/** Weighted demand and revenue per project, for the Project Overview chart. */
export async function getProjectDemand(): Promise<ProjectDemand[]> {
  const scenarioId = await defaultScenarioId();
  if (!scenarioId) return [];

  const projects = await db.project.findMany({
    where: { NOT: { projectStatus: { name: "Cancelled" } } },
    select: {
      id: true,
      name: true,
      revenueForecast: true,
      ragStatus: true,
      probabilityOverridePct: true,
      projectStatus: { select: { defaultProbabilityPct: true } },
      forecastAllocations: { where: { scenarioId }, select: { hours: true } },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => {
    const probability = Number(p.probabilityOverridePct ?? p.projectStatus.defaultProbabilityPct) / 100;
    const hours = p.forecastAllocations.reduce((sum, a) => sum + Number(a.hours), 0);
    return {
      projectId: p.id,
      projectName: p.name,
      weightedHours: Math.round(hours * probability * 10) / 10,
      revenueForecast: p.revenueForecast ? Number(p.revenueForecast) : null,
      ragStatus: p.ragStatus,
    };
  });
}
