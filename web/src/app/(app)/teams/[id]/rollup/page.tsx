import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveScenario } from "@/lib/scenario";
import { ensureCalendarWeeksInRange } from "@/lib/forecast-grid";
import { getTeamRollup } from "@/lib/team-rollup";
import { TeamRollupTable } from "@/components/team-rollup";
import { PageHeader, Card } from "@/components/page";

const MONTH_WINDOW = 6;

export default async function TeamRollupPage({ params }: PageProps<"/teams/[id]/rollup">) {
  const { id } = await params;
  const teamId = Number(id);

  const [team, scenario] = await Promise.all([
    db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } }),
    getActiveScenario(),
  ]);
  if (!team) notFound();

  if (!scenario) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`${team.name} — Rollup`} />
        <Card>
          <p className="text-sm text-slate-500">No scenario is available. Create a Scenario first (Settings → Scenario).</p>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const months = await ensureCalendarWeeksInRange(startMonth, MONTH_WINDOW);
  const rollup = await getTeamRollup(teamId, scenario.id, months);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${team.name} — Rollup`}
        description={`This team's committed hours summed across every project it's linked to. Read-only — edit hours from each project's own forecast grid. Scenario: ${scenario.name}${scenario.isLocked ? " (locked)" : ""}.`}
      />
      <Card>
        <TeamRollupTable months={rollup.months} projects={rollup.projects} />
      </Card>
    </div>
  );
}
