import Link from "next/link";
import { db } from "@/lib/db";
import { createTeamAction, deleteTeamAction } from "@/app/actions/org";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { TeamForm } from "@/components/team-form";
import { DeleteButton } from "@/components/form";

export default async function TeamsPage({ searchParams }: PageProps<"/teams">) {
  const { error } = await searchParams;
  const [teams, departments, employees] = await Promise.all([
    db.team.findMany({
      orderBy: { name: "asc" },
      include: { department: true, manager: { select: { name: true } }, _count: { select: { employees: true } } },
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teams" description="dim_Team — every employee belongs to a team (§5.1); Team is also a valid forecast target for Team-mode planning (§7)." />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <DataTable head={["Name", "Department", "Manager", "Headcount", "Budgeted", ""]}>
          {teams.map((t) => (
            <Row key={t.id}>
              <Cell>{t.name}</Cell>
              <Cell>{t.department.name}</Cell>
              <Cell>{t.manager?.name ?? "—"}</Cell>
              <Cell align="right">{t._count.employees}</Cell>
              <Cell align="right">{t.budgetedHeadcount?.toString() ?? "—"}</Cell>
              <Cell align="right">
                <div className="flex justify-end gap-2">
                  <Link href={`/teams/${t.id}/rollup`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                    Rollup
                  </Link>
                  <Link href={`/teams/${t.id}/edit`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                    Edit
                  </Link>
                  <form action={deleteTeamAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <DeleteButton />
                  </form>
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add new</h2>
          <TeamForm action={createTeamAction} departments={departments} employees={employees} submitLabel="Add" />
        </Card>
      </div>
    </div>
  );
}
