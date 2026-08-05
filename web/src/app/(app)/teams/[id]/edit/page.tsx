import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateTeamAction } from "@/app/actions/org";
import { Card, PageHeader } from "@/components/page";
import { TeamForm } from "@/components/team-form";

export default async function EditTeamPage({ params }: PageProps<"/teams/[id]/edit">) {
  const { id } = await params;
  const [team, departments, employees] = await Promise.all([
    db.team.findUnique({ where: { id: Number(id) } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!team) notFound();

  const action = updateTeamAction.bind(null, team.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Team" />
      <Card>
        <TeamForm
          action={action}
          departments={departments}
          employees={employees}
          defaults={{ ...team, budgetedHeadcount: team.budgetedHeadcount?.toString() ?? null }}
          submitLabel="Save changes"
        />
      </Card>
    </div>
  );
}
