import { db } from "@/lib/db";
import { getDemandBridge, getMonthlyDemandVsCapacity, getUtilisationHeatmap } from "@/lib/measures";
import { ManhattanChart } from "@/components/charts/ManhattanChart";
import { DemandWaterfall } from "@/components/charts/DemandWaterfall";
import { UtilisationHeatmap } from "@/components/charts/UtilisationHeatmap";
import { Card } from "@/components/page";

async function getOverview() {
  const [employeeCount, projectCount, teamCount, openRequisitions, allocationCount] = await Promise.all([
    db.employee.count({ where: { status: { name: "Active" } } }),
    db.project.count({ where: { NOT: { projectStatus: { name: "Cancelled" } } } }),
    db.team.count(),
    db.recruitment.count({ where: { NOT: { recruitmentStatus: { name: { in: ["Cancelled", "Started"] } } } } }),
    db.forecastAllocation.count(),
  ]);

  const recentAllocations = await db.forecastAllocation.findMany({
    take: 6,
    orderBy: { dateKey: "desc" },
    include: {
      project: { select: { name: true } },
      employee: { select: { name: true } },
      team: { select: { name: true } },
      skill: { select: { name: true } },
      forecastSource: { select: { name: true } },
    },
  });

  return { employeeCount, projectCount, teamCount, openRequisitions, allocationCount, recentAllocations };
}

function allocationTarget(a: Awaited<ReturnType<typeof getOverview>>["recentAllocations"][number]) {
  if (a.employee) return `${a.employee.name} (employee)`;
  if (a.team) return `${a.team.name} (team)`;
  if (a.skill) return `${a.skill.name} (skill)`;
  return "—";
}

export default async function DashboardPage() {
  const [overview, monthly, bridge, heatmap] = await Promise.all([
    getOverview(),
    getMonthlyDemandVsCapacity({ months: 6 }),
    getDemandBridge(),
    getUtilisationHeatmap(6),
  ]);

  const current = monthly[0];
  const currentUtilisationPct = current.availableHours > 0 ? Math.round((current.demandHours / current.availableHours) * 1000) / 10 : null;
  const headroomHours = current.availableHours - current.demandHours;

  const kpis = [
    { label: "Active employees", value: overview.employeeCount },
    { label: "Live projects", value: overview.projectCount },
    { label: "This month utilisation", value: currentUtilisationPct === null ? "—" : `${currentUtilisationPct}%` },
    { label: "This month headroom", value: `${headroomHours.toLocaleString()} hrs` },
    { label: "Weighted demand", value: `${bridge.weightedHours.toLocaleString()} hrs` },
    { label: "Open requisitions", value: overview.openRequisitions },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Business Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          §9 Business Overview — live from the relational model, Baseline scenario, next 6 months.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{k.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Demand vs capacity</h2>
            <p className="mb-4 text-xs text-slate-400">Manhattan chart (§9) — booked hours against available hours, all teams.</p>
            <ManhattanChart data={monthly} />
          </Card>
        </div>
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Demand bridge</h2>
          <p className="mb-4 text-xs text-slate-400">§7.1 — Committed → Weighted → Stretch.</p>
          <DemandWaterfall bridge={bridge} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Utilisation by team</h2>
        <p className="mb-4 text-xs text-slate-400">§7.2 Utilisation % = Booked Hours ÷ Available Hours, per team per month.</p>
        <UtilisationHeatmap rows={heatmap} />
      </Card>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent forecast allocations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Allocated to</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentAllocations.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.dateKey}</td>
                  <td className="px-4 py-2 text-slate-700">{a.project?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{allocationTarget(a)}</td>
                  <td className="px-4 py-2 text-slate-500">{a.forecastSource.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{a.hours.toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
