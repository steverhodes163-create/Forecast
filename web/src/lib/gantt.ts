// Read model for the Gantt page (§ task-driven forecasting). Runs
// computeSchedule fresh on every read (cheap, pure function) so the page
// always reflects the live task graph, rather than trusting only whatever
// was last persisted by recomputeProjectSchedule.
import { db } from "@/lib/db";
import { computeSchedule, type DependencyEdge, type TaskNode } from "@/lib/scheduling";

export type GanttTask = {
  id: number;
  name: string;
  durationDays: number;
  startDate: Date;
  endDate: Date;
  isCritical: boolean;
  slack: number;
  manualDateConflict: boolean;
  manualStartDate: Date | null;
  notes: string | null;
  dependsOn: number[];
  assignees: { employeeId: number; name: string; fte: number }[];
};

export type ProjectGantt = {
  anchorDate: Date;
  tasks: GanttTask[];
};

export async function getProjectGantt(projectId: number): Promise<ProjectGantt> {
  const [project, tasks, dependencies, assignments] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, select: { startDate: true } }),
    db.task.findMany({
      where: { projectId },
      orderBy: { id: "asc" },
      select: { id: true, name: true, durationDays: true, manualStartDate: true, notes: true },
    }),
    db.taskDependency.findMany({
      where: { predecessorTask: { projectId } },
      select: { predecessorTaskId: true, successorTaskId: true, lagDays: true },
    }),
    db.taskAssignment.findMany({
      where: { task: { projectId } },
      select: { taskId: true, employeeId: true, fte: true, employee: { select: { name: true } } },
    }),
  ]);

  const anchorDate = project.startDate ?? new Date();
  const taskNodes: TaskNode[] = tasks.map((t) => ({ id: t.id, durationDays: t.durationDays, manualStartDate: t.manualStartDate }));
  const depEdges: DependencyEdge[] = dependencies;
  const schedule = computeSchedule(taskNodes, depEdges, anchorDate);

  const dependsOnByTask = new Map<number, number[]>();
  for (const d of dependencies) {
    const list = dependsOnByTask.get(d.successorTaskId) ?? [];
    list.push(d.predecessorTaskId);
    dependsOnByTask.set(d.successorTaskId, list);
  }
  const assignmentsByTask = new Map<number, { employeeId: number; name: string; fte: number }[]>();
  for (const a of assignments) {
    const list = assignmentsByTask.get(a.taskId) ?? [];
    list.push({ employeeId: a.employeeId, name: a.employee.name, fte: Number(a.fte) });
    assignmentsByTask.set(a.taskId, list);
  }

  const ganttTasks: GanttTask[] = tasks.map((t) => {
    const s = schedule.get(t.id);
    return {
      id: t.id,
      name: t.name,
      durationDays: t.durationDays,
      startDate: s?.startDate ?? anchorDate,
      endDate: s?.endDate ?? anchorDate,
      isCritical: s?.isCritical ?? false,
      slack: s?.slack ?? 0,
      manualDateConflict: s?.manualDateConflict ?? false,
      manualStartDate: t.manualStartDate,
      notes: t.notes,
      dependsOn: dependsOnByTask.get(t.id) ?? [],
      assignees: assignmentsByTask.get(t.id) ?? [],
    };
  });

  return { anchorDate, tasks: ganttTasks };
}
