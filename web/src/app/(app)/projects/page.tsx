import { db } from "@/lib/db";

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

export default async function ProjectsPage() {
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
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Master data, read-only in this phase. Weighted demand (§7.1) uses the probability shown here.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Probability</th>
              <th className="px-4 py-2 text-right">Revenue forecast</th>
              <th className="px-4 py-2">RAG</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-2 text-slate-600">{p.customer.name}</td>
                <td className="px-4 py-2 text-slate-600">{p.projectStatus.name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {(p.probabilityOverridePct ?? p.projectStatus.defaultProbabilityPct).toString()}%
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {p.revenueForecast ? `£${Number(p.revenueForecast).toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ragClasses(p.ragStatus)}`}
                  >
                    {p.ragStatus ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
