import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateEmployeeAction } from "@/app/actions/employees";
import { getEmployeeFormRefData } from "@/lib/employee-ref-data";
import { Card, PageHeader } from "@/components/page";
import { EmployeeForm } from "@/components/employee-form";

export default async function EditEmployeePage({ params }: PageProps<"/employees/[id]/edit">) {
  const { id } = await params;
  const [employee, refData] = await Promise.all([
    db.employee.findUnique({ where: { id: Number(id) } }),
    getEmployeeFormRefData(),
  ]);
  if (!employee) notFound();

  const action = updateEmployeeAction.bind(null, employee.id);
  const defaults = {
    ...employee,
    contractHoursPerWeek: employee.contractHoursPerWeek.toString(),
    standardWeeklyHours: employee.standardWeeklyHours.toString(),
    fte: employee.fte.toString(),
    costRate: employee.costRate.toString(),
    chargeRate: employee.chargeRate?.toString() ?? null,
    holidayAllowanceDays: employee.holidayAllowanceDays?.toString() ?? null,
    trainingAllowanceDays: employee.trainingAllowanceDays?.toString() ?? null,
    utilisationTargetPct: employee.utilisationTargetPct?.toString() ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${employee.name}`} />
      <Card>
        <EmployeeForm action={action} refData={refData} defaults={defaults} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
