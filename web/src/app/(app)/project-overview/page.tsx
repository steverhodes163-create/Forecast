import Link from "next/link";
import { db } from "@/lib/db";
import { getProjectDemand } from "@/lib/measures";
import { getActiveScenarioId } from "@/lib/scenario";
import { ProjectDemandChart } from "@/components/charts/ProjectDemandChart";
import { DashboardFilterBar } from "@/components/dashboard-filter-bar";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";

function ragClasses(rag: string | null) {
  switch (rag) {
    case "Green":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "Amber":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "Red":
      return "bg-red-50 text-red-700 ring-red-600/20";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-500/20";
  }
}

export default async function ProjectOverviewPage({ searchParams }: PageProps<"/project-overview">) {
  const { customerId: customerIdParam, projectStatusId: statusIdParam } = await searchParams;
  const customerId = customerIdParam ? Number(customerIdParam) : undefined;
  const projectStatusId = statusIdParam ? Number(statusIdParam) : undefined;

  const [customers, statuses, projects, activeScenarioId] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.projectStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    getProjectDemand({ customerId, projectStatusId }),
    getActiveScenarioId(),
  ]);
  const adjustmentCount = activeScenarioId ? await db.scenarioAdjustment.count({ where: { scenarioId: activeScenarioId } }) : 0;

  const totalRevenue = projects.reduce((sum, p) => sum + (p.revenueForecast ?? 0), 0);
  const totalWeightedHours = projects.reduce((sum, p) => sum + p.weightedHours, 0);
  const atRiskCount = projects.filter((p) => p.ragStatus === "Red" || p.ragStatus === "Amber").length;

  const kpis = [
    { label: "Active projects", value: projects.length },
    { label: "Weighted demand", value: `${totalWeightedHours.toLocaleString()} hrs` },
    { label: "Revenue forecast", value: `£${totalRevenue.toLocaleString()}` },
    { label: "Amber/Red projects", value: atRiskCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Project Overview" description="§9 Project Overview — weighted demand (§7.1) and RAG status per project." />

      <DashboardFilterBar
        filters={[
          {
            name: "customerId",
            label: "Customer",
            value: customerId ? String(customerId) : "",
            options: customers.map((c) => ({ value: String(c.id), label: c.name })),
          },
          {
            name: "projectStatusId",
            label: "Status",
            value: projectStatusId ? String(projectStatusId) : "",
            options: statuses.map((s) => ({ value: String(s.id), label: s.name })),
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{k.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Weighted demand by project</h2>
          {adjustmentCount > 0 ? (
            <Link href="/what-if" className="text-xs font-medium text-slate-500 hover:text-slate-900">
              {adjustmentCount} what-if adjustment{adjustmentCount === 1 ? "" : "s"} applied →
            </Link>
          ) : null}
        </div>
        <p className="mb-4 text-xs text-slate-400">Bar colour follows RAG status.</p>
        <ProjectDemandChart data={projects} />
      </Card>

      <DataTable head={["Project", "RAG", "Weighted demand", "Revenue forecast"]}>
        {projects.map((p) => (
          <Row key={p.projectId}>
            <Cell>
              <span className="font-medium text-slate-800">{p.projectName}</span>
            </Cell>
            <Cell>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ragClasses(p.ragStatus)}`}>
                {p.ragStatus ?? "—"}
              </span>
            </Cell>
            <Cell align="right">{p.weightedHours.toLocaleString()} hrs</Cell>
            <Cell align="right">{p.revenueForecast ? `£${p.revenueForecast.toLocaleString()}` : "—"}</Cell>
          </Row>
        ))}
        {projects.length === 0 ? (
          <Row>
            <Cell>
              <span className="text-slate-400">No projects match this filter.</span>
            </Cell>
          </Row>
        ) : null}
      </DataTable>
    </div>
  );
}
