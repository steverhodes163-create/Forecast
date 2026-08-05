import { createEmployeeAction } from "@/app/actions/employees";
import { getEmployeeFormRefData } from "@/lib/employee-ref-data";
import { Card, PageHeader } from "@/components/page";
import { EmployeeForm } from "@/components/employee-form";

export default async function NewEmployeePage() {
  const refData = await getEmployeeFormRefData();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add Employee" description="Creates a new dim_Employee row (§5.1)." />
      <Card>
        <EmployeeForm action={createEmployeeAction} refData={refData} submitLabel="Create employee" />
      </Card>
    </div>
  );
}
