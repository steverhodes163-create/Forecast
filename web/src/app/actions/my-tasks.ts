"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { setTaskCompletion } from "@/lib/task-service";

type ActionResult = { ok: true } | { error: string };

// Gated by "the caller is assigned to this task" rather than requireEditor
// -- any employee can mark their own work done, without needing the
// ADMIN/PMO/ENGINEERING_LEAD role that editing the plan's structure needs.
export async function markMyTaskCompleteAction(input: { taskId: number; completed: boolean }): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");
    const user = await db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { employeeId: true } });
    if (!user.employeeId) throw new Error("Your account isn't linked to an employee record.");
    const assignment = await db.taskAssignment.findFirst({ where: { taskId: input.taskId, employeeId: user.employeeId } });
    if (!assignment) throw new Error("You're not assigned to this task.");
    await setTaskCompletion(input.taskId, input.completed);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update task." };
  }
  revalidatePath("/my-tasks");
  return { ok: true };
}
