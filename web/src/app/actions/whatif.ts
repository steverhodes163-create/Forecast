"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";

const PROJECT_SCOPED_TYPES = ["Delay", "Cancel", "Win"];

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO"])) {
    throw new Error("You do not have permission to manage what-if adjustments.");
  }
}

export async function createAdjustmentAction(formData: FormData) {
  const scenarioId = Number(formData.get("scenarioId"));

  try {
    await requireEditor();

    const adjustmentTypeId = Number(formData.get("adjustmentTypeId"));
    if (!adjustmentTypeId) throw new Error("Adjustment type is required.");
    const adjustmentType = await db.adjustmentType.findUnique({ where: { id: adjustmentTypeId }, select: { name: true } });
    if (!adjustmentType) throw new Error("Unknown adjustment type.");

    const projectIdRaw = formData.get("projectId");
    const teamIdRaw = formData.get("teamId");
    const projectId = projectIdRaw ? Number(projectIdRaw) : null;
    const teamId = teamIdRaw ? Number(teamIdRaw) : null;

    const isProjectScoped = PROJECT_SCOPED_TYPES.includes(adjustmentType.name);
    if (isProjectScoped && !projectId) {
      throw new Error(`${adjustmentType.name} needs a project.`);
    }
    if (!isProjectScoped && !teamId) {
      throw new Error(`${adjustmentType.name} needs a team.`);
    }

    const deltaWeeksRaw = formData.get("deltaWeeks");
    const deltaWeeks = deltaWeeksRaw ? parseInt(String(deltaWeeksRaw), 10) : null;
    if (adjustmentType.name === "Delay" && !deltaWeeks) {
      throw new Error("Delay needs a number of weeks.");
    }

    const effectiveDateKeyRaw = formData.get("effectiveDateKey");
    const effectiveDateKey = effectiveDateKeyRaw ? Number(effectiveDateKeyRaw) : null;

    const notesRaw = formData.get("notes");
    const notes = notesRaw && String(notesRaw).trim() ? String(notesRaw).trim() : null;

    const session = await getSession();

    await db.scenarioAdjustment.create({
      data: {
        scenarioId,
        adjustmentTypeId,
        projectId: isProjectScoped ? projectId : null,
        teamId: isProjectScoped ? null : teamId,
        deltaWeeks,
        effectiveDateKey,
        notes,
        createdBy: session?.email ?? null,
      },
    });
  } catch (e) {
    redirect(`/what-if?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not create adjustment.")}`);
  }

  revalidatePath("/what-if");
  revalidatePath("/dashboard");
  revalidatePath("/project-overview");
  redirect("/what-if");
}

export async function deleteAdjustmentAction(formData: FormData) {
  const id = Number(formData.get("id"));
  try {
    await requireEditor();
    await db.scenarioAdjustment.delete({ where: { id } });
  } catch (e) {
    redirect(`/what-if?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not delete adjustment.")}`);
  }
  revalidatePath("/what-if");
  revalidatePath("/dashboard");
  revalidatePath("/project-overview");
  redirect("/what-if");
}
