// Cross-project team rollup: a team's committed hours summed across every
// project it's linked to (the ProjectTeam side, mirrored -- see
// getProjectForecastGrid in forecast-grid.ts, which shows the reverse: one
// project's teams). Read-only -- nothing here is ever written back.
import { db } from "@/lib/db";
import type { GridMonthColumn } from "@/lib/forecast-grid";
import { resolveScenarioSourceId } from "@/lib/scenario";
import { applyProjectAdjustments, getScenarioAdjustments } from "@/lib/whatif";

export type RollupProjectRow = {
  projectId: number;
  projectName: string;
  hoursByDateKey: Record<number, number>;
};

export type TeamRollup = {
  teamId: number;
  teamName: string;
  months: GridMonthColumn[];
  projects: RollupProjectRow[];
};

export async function getTeamRollup(
  teamId: number,
  scenarioId: number,
  months: GridMonthColumn[],
  opts?: { applyAdjustments?: boolean }
): Promise<TeamRollup> {
  const dateKeys = months.flatMap((m) => m.weeks.map((w) => w.dateKey));
  const applyAdjustments = opts?.applyAdjustments ?? true;
  const resolvedScenarioId = await resolveScenarioSourceId(scenarioId);

  const [team, projectTeams, adjustments] = await Promise.all([
    db.team.findUniqueOrThrow({ where: { id: teamId }, select: { id: true, name: true } }),
    db.projectTeam.findMany({
      where: { teamId },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { project: { name: "asc" } },
    }),
    applyAdjustments ? getScenarioAdjustments(scenarioId) : Promise.resolve([]),
  ]);

  const projectIds = projectTeams.map((pt) => pt.projectId);
  const allocations = projectIds.length
    ? await db.forecastAllocation.findMany({
        where: { scenarioId: resolvedScenarioId, projectId: { in: projectIds }, employee: { teamId }, dateKey: { in: dateKeys } },
        select: { projectId: true, dateKey: true, hours: true },
      })
    : [];

  const adjustedRows = applyProjectAdjustments(
    allocations.map((a) => ({ projectId: a.projectId, dateKey: a.dateKey, hours: Number(a.hours) })),
    adjustments
  );

  const hoursByProject = new Map<number, Record<number, number>>();
  for (const row of adjustedRows) {
    if (row.projectId == null) continue;
    const bucket = hoursByProject.get(row.projectId) ?? {};
    bucket[row.dateKey] = (bucket[row.dateKey] ?? 0) + row.hours;
    hoursByProject.set(row.projectId, bucket);
  }

  const projects: RollupProjectRow[] = projectTeams.map((pt) => ({
    projectId: pt.project.id,
    projectName: pt.project.name,
    hoursByDateKey: hoursByProject.get(pt.project.id) ?? {},
  }));

  return { teamId: team.id, teamName: team.name, months, projects };
}
