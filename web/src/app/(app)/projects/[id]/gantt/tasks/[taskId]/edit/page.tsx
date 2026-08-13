import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateTaskAction } from "@/app/actions/tasks";
import { Card, PageHeader } from "@/components/page";
import { TaskForm } from "@/components/task-form";

export default async function EditTaskPage({ params }: PageProps<"/projects/[id]/gantt/tasks/[taskId]/edit">) {
  const { id, taskId } = await params;
  const projectId = Number(id);
  const taskIdNum = Number(taskId);

  const [task, otherTasks, employees, assignments, dependsOnRows] = await Promise.all([
    db.task.findUnique({ where: { id: taskIdNum } }),
    db.task.findMany({ where: { projectId, id: { not: taskIdNum } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.taskAssignment.findMany({ where: { taskId: taskIdNum }, select: { employeeId: true, fte: true } }),
    db.taskDependency.findMany({ where: { successorTaskId: taskIdNum }, select: { predecessorTaskId: true } }),
  ]);
  if (!task) notFound();

  const action = updateTaskAction.bind(null, task.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${task.name}`} />
      <Card>
        <TaskForm
          action={action}
          projectId={projectId}
          otherTasks={otherTasks}
          employees={employees}
          submitLabel="Save changes"
          defaults={{
            name: task.name,
            durationDays: task.durationDays,
            manualStartDate: task.manualStartDate ? task.manualStartDate.toISOString().slice(0, 10) : null,
            notes: task.notes,
            dependsOn: dependsOnRows.map((d) => d.predecessorTaskId),
            assignees: assignments.map((a) => ({ employeeId: a.employeeId, fte: Number(a.fte) })),
          }}
        />
      </Card>
    </div>
  );
}
