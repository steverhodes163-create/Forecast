import Link from "next/link";
import { db } from "@/lib/db";
import { deleteEmployeeAction } from "@/app/actions/employees";
import { DataTable, PageHeader, Row, Cell } from "@/components/page";
import { DeleteButton } from "@/components/form";

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const { error } = await searchParams;
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
      <PageHeader
        title="Employees"
        description="dim_Employee (§5.1) — replaces MST_Employees."
        action={{ href: "/employees/new", label: "Add Employee" }}
      />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}
      <DataTable head={["Name", "Department", "Team", "Role", "FTE", "Cost rate", "Status", ""]}>
        {employees.map((e) => (
          <Row key={e.id}>
            <Cell>
              <span className="font-medium text-slate-800">{e.name}</span>
            </Cell>
            <Cell>{e.department.name}</Cell>
            <Cell>{e.team?.name ?? "—"}</Cell>
            <Cell>{e.jobRole.name}</Cell>
            <Cell align="right">{e.fte.toString()}</Cell>
            <Cell align="right">£{e.costRate.toString()}/h</Cell>
            <Cell>{e.status.name}</Cell>
            <Cell align="right">
              <div className="flex justify-end gap-2">
                <Link href={`/employees/${e.id}/edit`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  Edit
                </Link>
                <form action={deleteEmployeeAction}>
                  <input type="hidden" name="id" value={e.id} />
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
