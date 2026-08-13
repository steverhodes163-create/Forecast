"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";
import { recomputeProjectSchedule } from "@/lib/task-service";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "ENGINEERING_LEAD"])) {
    throw new Error("You do not have permission to manage tasks.");
  }
}

function requiredInt(formData: FormData, name: string, label: string): number {
  const raw = formData.get(name);
  if (!raw) throw new Error(`${label} is required.`);
  return parseInt(String(raw), 10);
}

// Would adding predecessorId -> successorId close a loop? True if
// predecessorId is reachable FROM successorId via existing edges (i.e.
// successorId is already a transitive predecessor of predecessorId).
// `excludeEdgesForSuccessorId` drops a task's own current incoming edges
// from the graph first, since a save wholesale-replaces them.
async function wouldCreateCycle(
  projectId: number,
  predecessorId: number,
  successorId: number,
  excludeEdgesForSuccessorId?: number
): Promise<boolean> {
  if (predecessorId === successorId) return true;
  const allDeps = await db.taskDependency.findMany({
    where: { predecessorTask: { projectId } },
    select: { predecessorTaskId: true, successorTaskId: true },
  });
  const edges = excludeEdgesForSuccessorId != null ? allDeps.filter((d) => d.successorTaskId !== excludeEdgesForSuccessorId) : allDeps;
  const successorsOf = new Map<number, number[]>();
  for (const d of edges) {
    const list = successorsOf.get(d.predecessorTaskId) ?? [];
    list.push(d.successorTaskId);
    successorsOf.set(d.predecessorTaskId, list);
  }
  const queue = [successorId];
  const seen = new Set<number>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current === predecessorId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of successorsOf.get(current) ?? []) queue.push(next);
  }
  return false;
}

// Replaces a task's dependencies + assignments from form data (used by both
// create and update). Cycle-checks every proposed dependency against the
// graph with this task's own current incoming edges removed, and aborts
// without writing anything if any would close a loop.
async function saveTaskGraph(taskId: number, projectId: number, formData: FormData): Promise<void> {
  const dependsOnIds = Array.from(new Set(formData.getAll("dependsOn").map((v) => parseInt(String(v), 10)))).filter(
    (n) => !Number.isNaN(n) && n !== taskId
  );
  for (const predecessorId of dependsOnIds) {
    if (await wouldCreateCycle(projectId, predecessorId, taskId, taskId)) {
      throw new Error("That dependency would create a circular dependency between tasks.");
    }
  }
  await db.taskDependency.deleteMany({ where: { successorTaskId: taskId } });
  if (dependsOnIds.length > 0) {
    await db.taskDependency.createMany({ data: dependsOnIds.map((predecessorId) => ({ predecessorTaskId: predecessorId, successorTaskId: taskId })) });
  }

  const assigneeIds = Array.from(new Set(formData.getAll("assignee").map((v) => parseInt(String(v), 10)))).filter((n) => !Number.isNaN(n));
  await db.taskAssignment.deleteMany({ where: { taskId } });
  if (assigneeIds.length > 0) {
    await db.taskAssignment.createMany({
      data: assigneeIds.map((employeeId) => {
        const fteRaw = formData.get(`fte_${employeeId}`);
        const fte = fteRaw ? Number(fteRaw) : 1;
        return { taskId, employeeId, fte: fte.toFixed(3) };
      }),
    });
  }
}

function taskFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Task name is required.");
  const durationDays = requiredInt(formData, "durationDays", "Duration");
  if (durationDays < 1) throw new Error("Duration must be at least 1 working day.");
  const manualStartRaw = formData.get("manualStartDate");
  const manualStartDate = manualStartRaw ? new Date(String(manualStartRaw)) : null;
  const notes = formData.get("notes") ? String(formData.get("notes")) : null;
  return { name, durationDays, manualStartDate, notes };
}

export async function createTaskAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const projectId = requiredInt(formData, "projectId", "Project");
  try {
    await requireEditor();
    const task = await db.task.create({ data: { projectId, ...taskFields(formData) } });
    await saveTaskGraph(task.id, projectId, formData);
    await recomputeProjectSchedule(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create task." };
  }
  revalidatePath(`/projects/${projectId}/gantt`);
  revalidatePath(`/projects/${projectId}/forecast`);
  redirect(`/projects/${projectId}/gantt`);
}

export async function updateTaskAction(taskId: number, _prevState: FormState, formData: FormData): Promise<FormState> {
  const projectId = requiredInt(formData, "projectId", "Project");
  try {
    await requireEditor();
    await db.task.update({ where: { id: taskId }, data: taskFields(formData) });
    await saveTaskGraph(taskId, projectId, formData);
    await recomputeProjectSchedule(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update task." };
  }
  revalidatePath(`/projects/${projectId}/gantt`);
  revalidatePath(`/projects/${projectId}/forecast`);
  redirect(`/projects/${projectId}/gantt`);
}

export async function deleteTaskAction(formData: FormData) {
  await requireEditor();
  const taskId = Number(formData.get("taskId"));
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { projectId: true } });
  await db.forecastAllocation.deleteMany({ where: { taskId } });
  await db.taskAssignment.deleteMany({ where: { taskId } });
  await db.taskDependency.deleteMany({ where: { OR: [{ predecessorTaskId: taskId }, { successorTaskId: taskId }] } });
  await db.task.delete({ where: { id: taskId } });
  await recomputeProjectSchedule(task.projectId);
  revalidatePath(`/projects/${task.projectId}/gantt`);
  revalidatePath(`/projects/${task.projectId}/forecast`);
  redirect(`/projects/${task.projectId}/gantt`);
}

// Re-runs hours generation against whichever scenario is currently active,
// without changing any task/dependency/assignment data -- covers the case
// where the user switched the active scenario after a task was last saved.
export async function recalculateScheduleAction(formData: FormData) {
  await requireEditor();
  const projectId = Number(formData.get("projectId"));
  await recomputeProjectSchedule(projectId);
  revalidatePath(`/projects/${projectId}/gantt`);
  revalidatePath(`/projects/${projectId}/forecast`);
  redirect(`/projects/${projectId}/gantt`);
}
