import { db } from "@/lib/db";
import { getTeamHeadcount, getUtilisationHeatmap } from "@/lib/measures";
import { UtilisationTrendChart } from "@/components/charts/UtilisationTrendChart";
import { HeadcountChart } from "@/components/charts/HeadcountChart";
import { DashboardFilterBar } from "@/components/dashboard-filter-bar";
import { Card, PageHeader } from "@/components/page";

export default async function TeamOverviewPage({ searchParams }: PageProps<"/team-overview">) {
  const { teamId: teamIdParam } = await searchParams;
  const teamId = teamIdParam ? Number(teamIdParam) : undefined;

  const [teams, heatmap, headcount] = await Promise.all([
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getUtilisationHeatmap(6, { teamId }),
    getTeamHeadcount({ teamId }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team Overview"
        description="§9 Team Overview — utilisation trend and headcount vs vacancy vs recruitment pipeline."
      />

      <DashboardFilterBar
        filters={[
          {
            name: "teamId",
            label: "Team",
            value: teamId ? String(teamId) : "",
            options: teams.map((t) => ({ value: String(t.id), label: t.name })),
          },
        ]}
      />

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Utilisation trend</h2>
        <p className="mb-4 text-xs text-slate-400">§7.2 Utilisation % over the next 6 months, one line per team.</p>
        <UtilisationTrendChart rows={heatmap} />
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Headcount vs vacancy vs pipeline</h2>
        <p className="mb-4 text-xs text-slate-400">Current month — budgeted/actual headcount from fact_Capacity, open requisitions from fact_Recruitment.</p>
        <HeadcountChart data={headcount} />
      </Card>
    </div>
  );
}
