import { db } from "@/lib/db";
import { createDepartmentAction, deleteDepartmentAction } from "@/app/actions/org";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { DepartmentForm } from "@/components/department-form";
import { DeleteButton } from "@/components/form";
import Link from "next/link";

export default async function DepartmentsPage({ searchParams }: PageProps<"/departments">) {
  const { error } = await searchParams;
  const [departments, businessUnits] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" }, include: { businessUnit: true, _count: { select: { teams: true } } } }),
    db.businessUnit.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Departments" description="dim_Department — sits between Business Unit and Team in the org hierarchy (§5.1)." />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <DataTable head={["Name", "Business unit", "Teams", ""]}>
          {departments.map((d) => (
            <Row key={d.id}>
              <Cell>{d.name}</Cell>
              <Cell>{d.businessUnit.name}</Cell>
              <Cell align="right">{d._count.teams}</Cell>
              <Cell align="right">
                <div className="flex justify-end gap-2">
                  <Link href={`/departments/${d.id}/edit`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                    Edit
                  </Link>
                  <form action={deleteDepartmentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <DeleteButton />
                  </form>
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add new</h2>
          <DepartmentForm action={createDepartmentAction} businessUnits={businessUnits} submitLabel="Add" />
        </Card>
      </div>
    </div>
  );
}
