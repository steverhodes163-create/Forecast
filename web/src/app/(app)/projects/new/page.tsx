import { createProjectAction } from "@/app/actions/projects";
import { getProjectFormRefData } from "@/lib/project-ref-data";
import { Card, PageHeader } from "@/components/page";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const refData = await getProjectFormRefData();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add Project" description="Creates a new dim_Project row (§5.1)." />
      <Card>
        <ProjectForm action={createProjectAction} refData={refData} submitLabel="Create project" />
      </Card>
    </div>
  );
}
