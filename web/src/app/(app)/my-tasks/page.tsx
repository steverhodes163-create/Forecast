import { getMyTasks } from "@/lib/my-tasks";
import { MyTasksList } from "@/components/my-tasks-list";
import { Card, PageHeader } from "@/components/page";

export default async function MyTasksPage() {
  const { employeeLinked, tasks } = await getMyTasks();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Tasks"
        description="Every task you're personally assigned to, across all projects. Marking one done reschedules anything waiting on it from the actual finish date."
      />
      <Card>
        {employeeLinked ? (
          <MyTasksList tasks={tasks} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            Your account isn&apos;t linked to an employee record, so there&apos;s nothing to show here.
          </p>
        )}
      </Card>
    </div>
  );
}
