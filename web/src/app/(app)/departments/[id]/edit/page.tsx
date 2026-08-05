import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateDepartmentAction } from "@/app/actions/org";
import { Card, PageHeader } from "@/components/page";
import { DepartmentForm } from "@/components/department-form";

export default async function EditDepartmentPage({ params }: PageProps<"/departments/[id]/edit">) {
  const { id } = await params;
  const [department, businessUnits] = await Promise.all([
    db.department.findUnique({ where: { id: Number(id) } }),
    db.businessUnit.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!department) notFound();

  const action = updateDepartmentAction.bind(null, department.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Department" />
      <Card>
        <DepartmentForm action={action} businessUnits={businessUnits} defaults={department} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
