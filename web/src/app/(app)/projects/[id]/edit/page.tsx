import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateProjectAction } from "@/app/actions/projects";
import { getProjectFormRefData } from "@/lib/project-ref-data";
import { Card, PageHeader } from "@/components/page";
import { ProjectForm } from "@/components/project-form";

export default async function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  const { id } = await params;
  const [project, refData] = await Promise.all([
    db.project.findUnique({ where: { id: Number(id) } }),
    getProjectFormRefData(),
  ]);
  if (!project) notFound();

  const action = updateProjectAction.bind(null, project.id);
  const defaults = {
    ...project,
    probabilityOverridePct: project.probabilityOverridePct?.toString() ?? null,
    revenueForecast: project.revenueForecast?.toString() ?? null,
    budgetCost: project.budgetCost?.toString() ?? null,
    targetMarginPct: project.targetMarginPct?.toString() ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${project.name}`} />
      <Card>
        <ProjectForm action={action} refData={refData} defaults={defaults} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
