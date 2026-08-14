// §7.4 the what-if engine. A scenario is "Baseline + adjustments" (see
// resolveScenarioSourceId in scenario.ts for how a branch scenario reads its
// base scenario's rows); this module resolves what those adjustment rows
// actually DO to a stream of allocations, at query time, without ever
// duplicating or mutating the underlying ForecastAllocation rows.
//
// Scoping: only Delay, Cancel and Win -- the three AdjustmentTypes the
// architecture doc gives concrete, computable resolution rules for -- have
// any effect here. Recruitment Freeze / New Hire / Contractor Loss / Team
// Expansion / Team Reduction remain creatable and visible (logged decisions
// against a scenario) but the schema carries no headcount/FTE magnitude for
// them, only deltaWeeks/notes, so they're not mathematically applied to any
// number. See web/README.md's What-If section for the full rationale.
import { db } from "@/lib/db";
import { dateKeyFor, dateKeyToDate } from "@/lib/calendar";

export type ScenarioAdjustmentRow = {
  id: number;
  adjustmentTypeName: string;
  projectId: number | null;
  projectName: string | null;
  teamId: number | null;
  teamName: string | null;
  deltaWeeks: number | null;
  effectiveDateKey: number | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
};

export async function getScenarioAdjustments(scenarioId: number): Promise<ScenarioAdjustmentRow[]> {
  const rows = await db.scenarioAdjustment.findMany({
    where: { scenarioId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      adjustmentType: { select: { name: true } },
      projectId: true,
      project: { select: { name: true } },
      teamId: true,
      team: { select: { name: true } },
      deltaWeeks: true,
      effectiveDateKey: true,
      notes: true,
      createdBy: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    adjustmentTypeName: r.adjustmentType.name,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
    teamId: r.teamId,
    teamName: r.team?.name ?? null,
    deltaWeeks: r.deltaWeeks,
    effectiveDateKey: r.effectiveDateKey,
    notes: r.notes,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

type ProjectAdjustment = { cancelFromDateKey: number | null; delayWeeks: number | null; delayFromDateKey: number | null; win: boolean };

function projectAdjustmentsFrom(adjustments: Pick<ScenarioAdjustmentRow, "adjustmentTypeName" | "projectId" | "deltaWeeks" | "effectiveDateKey">[]): Map<number, ProjectAdjustment> {
  const byProject = new Map<number, ProjectAdjustment>();
  const get = (projectId: number) => {
    let existing = byProject.get(projectId);
    if (!existing) {
      existing = { cancelFromDateKey: null, delayWeeks: null, delayFromDateKey: null, win: false };
      byProject.set(projectId, existing);
    }
    return existing;
  };
  for (const a of adjustments) {
    if (a.projectId == null) continue;
    const entry = get(a.projectId);
    if (a.adjustmentTypeName === "Cancel") {
      entry.cancelFromDateKey = a.effectiveDateKey ?? -Infinity;
    } else if (a.adjustmentTypeName === "Delay" && a.deltaWeeks) {
      entry.delayWeeks = a.deltaWeeks;
      entry.delayFromDateKey = a.effectiveDateKey ?? -Infinity;
    } else if (a.adjustmentTypeName === "Win") {
      entry.win = true;
    }
  }
  return byProject;
}

/**
 * Pure -- no DB access. Applies Cancel (drop matching rows) and Delay (shift
 * dateKey forward by deltaWeeks*7 days) to an already-fetched allocation
 * list. Rows for projects with no matching adjustment pass through
 * unchanged. Win has no effect here -- see effectiveProbabilityPct.
 */
export function applyProjectAdjustments<T extends { projectId: number | null; dateKey: number }>(
  rows: T[],
  adjustments: Pick<ScenarioAdjustmentRow, "adjustmentTypeName" | "projectId" | "deltaWeeks" | "effectiveDateKey">[]
): T[] {
  const byProject = projectAdjustmentsFrom(adjustments);
  const out: T[] = [];
  for (const row of rows) {
    const adj = row.projectId != null ? byProject.get(row.projectId) : undefined;
    if (!adj) {
      out.push(row);
      continue;
    }
    if (adj.cancelFromDateKey != null && row.dateKey >= adj.cancelFromDateKey) continue;
    if (adj.delayWeeks && adj.delayFromDateKey != null && row.dateKey >= adj.delayFromDateKey) {
      const shifted = dateKeyFor(new Date(dateKeyToDate(row.dateKey).getTime() + adj.delayWeeks * 7 * 24 * 60 * 60 * 1000));
      out.push({ ...row, dateKey: shifted });
      continue;
    }
    out.push(row);
  }
  return out;
}

/**
 * Pure -- no DB access. A Win adjustment for this project forces its
 * effective probability to 100%, overriding whatever the project's own
 * status-derived probability would otherwise be, for this scenario only.
 */
export function effectiveProbabilityPct(
  baseProbabilityPct: number,
  projectId: number | null,
  adjustments: Pick<ScenarioAdjustmentRow, "adjustmentTypeName" | "projectId">[]
): number {
  if (projectId == null) return baseProbabilityPct;
  const won = adjustments.some((a) => a.adjustmentTypeName === "Win" && a.projectId === projectId);
  return won ? 100 : baseProbabilityPct;
}
