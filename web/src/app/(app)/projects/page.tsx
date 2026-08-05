import Link from "next/link";
import { db } from "@/lib/db";
import { deleteProjectAction } from "@/app/actions/projects";
import { DataTable, PageHeader, Row, Cell } from "@/components/page";
import { DeleteButton } from "@/components/form";

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

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const { error } = await searchParams;
  const projects = await db.project.findMany({
    orderBy: { startDate: "asc" },
    include: {
      customer: { select: { name: true } },
      projectStatus: { select: { name: true, defaultProbabilityPct: true } },
      priority: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="dim_Project (§5.1) — Weighted Demand (§7.1) uses the probability shown here. Replaces MST_Projects."
        action={{ href: "/projects/new", label: "Add Project" }}
      />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}
      <DataTable head={["Project", "Customer", "Status", "Probability", "Revenue forecast", "RAG", ""]}>
        {projects.map((p) => (
          <Row key={p.id}>
            <Cell>
              <span className="font-medium text-slate-800">{p.name}</span>
            </Cell>
            <Cell>{p.customer.name}</Cell>
            <Cell>{p.projectStatus.name}</Cell>
            <Cell align="right">{(p.probabilityOverridePct ?? p.projectStatus.defaultProbabilityPct).toString()}%</Cell>
            <Cell align="right">{p.revenueForecast ? `£${Number(p.revenueForecast).toLocaleString()}` : "—"}</Cell>
            <Cell>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ragClasses(p.ragStatus)}`}>
                {p.ragStatus ?? "—"}
              </span>
            </Cell>
            <Cell align="right">
              <div className="flex justify-end gap-2">
                <Link href={`/projects/${p.id}/edit`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  Edit
                </Link>
                <form action={deleteProjectAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <DeleteButton />
                </form>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
    </div>
  );
}
