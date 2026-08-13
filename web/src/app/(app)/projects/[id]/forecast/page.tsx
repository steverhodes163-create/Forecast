import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveScenario } from "@/lib/scenario";
import { ensureCalendarWeeksInRange, getProjectForecastGrid } from "@/lib/forecast-grid";
import { ForecastGrid } from "@/components/forecast-grid";
import { PageHeader, Card } from "@/components/page";

const MONTH_WINDOW = 6;

export default async function ProjectForecastPage({ params }: PageProps<"/projects/[id]/forecast">) {
  const { id } = await params;
  const projectId = Number(id);

  const [project, scenario] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    getActiveScenario(),
  ]);
  if (!project) notFound();

  if (!scenario) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`${project.name} — Forecast grid`} />
        <Card>
          <p className="text-sm text-slate-500">No scenario is available. Create a Scenario first (Settings → Scenario).</p>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [months, addedTeamIds] = await Promise.all([
    ensureCalendarWeeksInRange(startMonth, MONTH_WINDOW),
    db.projectTeam.findMany({ where: { projectId }, select: { teamId: true } }),
  ]);

  const [grid, availableTeams] = await Promise.all([
    getProjectForecastGrid(projectId, scenario.id, months),
    db.team.findMany({
      where: { id: { notIn: addedTeamIds.map((t) => t.teamId) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${project.name} — Forecast grid`}
        description={`§7 calendarised entry — team and month rows/columns are computed rollups of their members/weeks. Task rows (§ task-driven forecasting) roll up automatically from the project's Gantt chart. Scenario: ${scenario.name}${scenario.isLocked ? " (locked — entry disabled)" : ""}.`}
        action={{ href: `/projects/${project.id}/gantt`, label: "Open Gantt chart" }}
      />
      <Card>
        <ForecastGrid
          projectId={project.id}
          scenarioId={scenario.id}
          scenarioLocked={scenario.isLocked}
          months={grid.months}
          teams={grid.teams}
          availableTeams={availableTeams}
        />
      </Card>
    </div>
  );
}
