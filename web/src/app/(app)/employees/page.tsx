import { db } from "@/lib/db";

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({
    orderBy: { name: "asc" },
    include: {
      department: { select: { name: true } },
      team: { select: { name: true } },
      jobRole: { select: { name: true } },
      status: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Employees</h1>
        <p className="mt-1 text-sm text-slate-500">
          Master data, read-only in this phase — input/edit screens (dim_Employee, §5.1) are Phase 2.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2 text-right">FTE</th>
              <th className="px-4 py-2 text-right">Cost rate</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{e.name}</td>
                <td className="px-4 py-2 text-slate-600">{e.department.name}</td>
                <td className="px-4 py-2 text-slate-600">{e.team?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{e.jobRole.name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">{e.fte.toString()}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">£{e.costRate.toString()}/h</td>
                <td className="px-4 py-2 text-slate-600">{e.status.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
