"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";
import { recomputeProjectSchedule, setTaskCompletion } from "@/lib/task-service";
import { parsePredecessors, parseResources } from "@/lib/task-shorthand";

type ActionResult = { ok: true } | { error: string };

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "ENGINEERING_LEAD"])) {
    throw new Error("You do not have permission to manage tasks.");
  }
}

function revalidateProject(projectId: number) {
  revalidatePath(`/projects/${projectId}/gantt`);
  revalidatePath(`/projects/${projectId}/forecast`);
  revalidatePath("/my-tasks");
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

export async function createBlankTaskAction(input: { projectId: number; name: string }): Promise<ActionResult & { taskId?: number }> {
  const { projectId } = input;
  try {
    await requireEditor();
    const name = input.name.trim();
    if (!name) throw new Error("Task name is required.");
    const task = await db.task.create({ data: { projectId, name, durationDays: 1 } });
    await recomputeProjectSchedule(projectId);
    revalidateProject(projectId);
    return { ok: true, taskId: task.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create task." };
  }
}

export async function setTaskNameAction(input: { taskId: number; projectId: number; name: string }): Promise<ActionResult> {
  const { taskId, projectId } = input;
  try {
    await requireEditor();
    const name = input.name.trim();
    if (!name) throw new Error("Task name is required.");
    await db.task.update({ where: { id: taskId }, data: { name } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not rename task." };
  }
  revalidateProject(projectId);
  return { ok: true };
}

export async function setTaskDurationAction(input: { taskId: number; projectId: number; raw: string }): Promise<ActionResult> {
  const { taskId, projectId } = input;
  try {
    await requireEditor();
    const cleaned = input.raw.trim().replace(/d(ays?)?$/i, "").trim();
    const days = parseInt(cleaned, 10);
    if (Number.isNaN(days) || days < 1) throw new Error(`"${input.raw}" isn't a valid duration — try "5" or "5d".`);
    await db.task.update({ where: { id: taskId }, data: { durationDays: days } });
    await recomputeProjectSchedule(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update duration." };
  }
  revalidateProject(projectId);
  return { ok: true };
}

export async function setTaskPredecessorsAction(input: { taskId: number; projectId: number; raw: string }): Promise<ActionResult> {
  const { taskId, projectId, raw } = input;
  try {
    await requireEditor();
    const parsed = parsePredecessors(raw);
    if ("error" in parsed) throw new Error(parsed.error);

    const validIds = new Set((await db.task.findMany({ where: { projectId }, select: { id: true } })).map((t) => t.id));
    for (const token of parsed.tokens) {
      if (!validIds.has(token.taskId)) throw new Error(`No task #${token.taskId} on this project.`);
      if (await wouldCreateCycle(projectId, token.taskId, taskId, taskId)) {
        throw new Error(`Task #${token.taskId} would create a circular dependency.`);
      }
    }

    await db.taskDependency.deleteMany({ where: { successorTaskId: taskId } });
    if (parsed.tokens.length > 0) {
      await db.taskDependency.createMany({
        data: parsed.tokens.map((t) => ({ predecessorTaskId: t.taskId, successorTaskId: taskId, lagDays: t.lagDays })),
      });
    }
    await recomputeProjectSchedule(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update dependencies." };
  }
  revalidateProject(projectId);
  return { ok: true };
}

export async function setTaskResourcesAction(input: { taskId: number; projectId: number; raw: string }): Promise<ActionResult> {
  const { taskId, projectId, raw } = input;
  try {
    await requireEditor();
    const parsed = parseResources(raw);
    if ("error" in parsed) throw new Error(parsed.error);

    const employees = await db.employee.findMany({ select: { id: true, name: true } });
    const byNameLower = new Map(employees.map((e) => [e.name.toLowerCase(), e.id]));
    const resolved: { employeeId: number; fte: number }[] = [];
    const unmatched: string[] = [];
    for (const token of parsed.tokens) {
      const employeeId = byNameLower.get(token.name.toLowerCase());
      if (employeeId === undefined) unmatched.push(token.name);
      else resolved.push({ employeeId, fte: token.pct / 100 });
    }
    if (unmatched.length > 0) {
      throw new Error(`Unknown employee${unmatched.length > 1 ? "s" : ""}: ${unmatched.join(", ")}`);
    }

    await db.taskAssignment.deleteMany({ where: { taskId } });
    if (resolved.length > 0) {
      await db.taskAssignment.createMany({
        data: resolved.map((r) => ({ taskId, employeeId: r.employeeId, fte: r.fte.toFixed(3) })),
      });
    }
    await recomputeProjectSchedule(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update resources." };
  }
  revalidateProject(projectId);
  return { ok: true };
}

export async function markTaskDoneAction(input: { taskId: number; projectId: number; completed: boolean }): Promise<ActionResult> {
  try {
    await requireEditor();
    await setTaskCompletion(input.taskId, input.completed);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update task." };
  }
  revalidateProject(input.projectId);
  return { ok: true };
}

export async function deleteTaskAction(input: { taskId: number; projectId: number }): Promise<ActionResult> {
  const { taskId, projectId } = input;
  try {
    await requireEditor();
    await db.forecastAllocation.deleteMany({ where: { taskId } });
    await db.taskAssignment.deleteMany({ where: { taskId } });
    await db.taskDependency.deleteMany({ where: { OR: [{ predecessorTaskId: taskId }, { successorTaskId: taskId }] } });
    await db.task.delete({ where: { id: taskId } });
    await recomputeProjectSchedule(projectId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not delete task." };
  }
  revalidateProject(projectId);
  return { ok: true };
}

// Re-runs hours generation against whichever scenario is currently active,
// without changing any task/dependency/assignment data -- covers the case
// where the user switched the active scenario after a task was last saved.
export async function recalculateScheduleAction(formData: FormData) {
  await requireEditor();
  const projectId = Number(formData.get("projectId"));
  await recomputeProjectSchedule(projectId);
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/gantt`);
}
