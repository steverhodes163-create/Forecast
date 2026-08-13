// Read model for the "My Tasks" self-service page -- every task the
// signed-in user's linked employee record is assigned to, across every
// project, using the schedule dates already persisted by
// recomputeProjectSchedule (src/lib/task-service.ts) rather than
// recomputing CPM live here (this spans many projects at once; the Gantt
// page is the one place that insists on a fresh live recompute).
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type MyTask = {
  taskId: number;
  taskName: string;
  projectId: number;
  projectName: string;
  durationDays: number;
  dueDate: Date | null;
  isCritical: boolean;
  isComplete: boolean;
  fte: number;
};

export async function getMyTasks(): Promise<{ employeeLinked: boolean; tasks: MyTask[] }> {
  const session = await getSession();
  if (!session) return { employeeLinked: false, tasks: [] };

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { employeeId: true } });
  if (!user?.employeeId) return { employeeLinked: false, tasks: [] };

  const assignments = await db.taskAssignment.findMany({
    where: { employeeId: user.employeeId },
    select: {
      fte: true,
      task: {
        select: {
          id: true,
          name: true,
          durationDays: true,
          computedEndDate: true,
          isCritical: true,
          completedAt: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ task: { completedAt: "asc" } }, { task: { computedEndDate: "asc" } }],
  });

  const tasks: MyTask[] = assignments.map((a) => ({
    taskId: a.task.id,
    taskName: a.task.name,
    projectId: a.task.project.id,
    projectName: a.task.project.name,
    durationDays: a.task.durationDays,
    dueDate: a.task.computedEndDate,
    isCritical: a.task.isCritical,
    isComplete: !!a.task.completedAt,
    fte: Number(a.fte),
  }));

  return { employeeLinked: true, tasks };
}
