"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";
import { gridDefaults } from "@/lib/forecast-grid";

type ActionResult = { ok: true } | { error: string };

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "ENGINEERING_LEAD"])) {
    throw new Error("You do not have permission to enter forecast allocations.");
  }
}

export async function setForecastCellAction(input: {
  projectId: number;
  employeeId: number;
  scenarioId: number;
  dateKey: number;
  hours: number;
}): Promise<ActionResult> {
  const { projectId, employeeId, scenarioId, dateKey, hours } = input;
  try {
    await requireEditor();
    const { resourceTypeId, forecastSourceId } = await gridDefaults();

    if (!hours || hours <= 0) {
      await db.forecastAllocation.deleteMany({
        where: { projectId, employeeId, scenarioId, dateKey, resourceTypeId, forecastSourceId },
      });
    } else {
      await db.forecastAllocation.upsert({
        where: { gridCell: { scenarioId, employeeId, projectId, dateKey, resourceTypeId, forecastSourceId } },
        update: { hours: hours.toFixed(2) },
        create: { scenarioId, employeeId, projectId, dateKey, resourceTypeId, forecastSourceId, hours: hours.toFixed(2) },
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save cell." };
  }
  revalidatePath(`/projects/${projectId}/forecast`);
  revalidatePath("/forecast");
  return { ok: true };
}

export async function addProjectTeamAction(input: { projectId: number; teamId: number }): Promise<ActionResult> {
  const { projectId, teamId } = input;
  try {
    await requireEditor();
    await db.projectTeam.upsert({
      where: { projectId_teamId: { projectId, teamId } },
      update: {},
      create: { projectId, teamId },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add team." };
  }
  revalidatePath(`/projects/${projectId}/forecast`);
  return { ok: true };
}

export async function removeProjectTeamAction(input: { projectId: number; teamId: number }): Promise<ActionResult> {
  const { projectId, teamId } = input;
  try {
    await requireEditor();
    await db.projectTeam.delete({ where: { projectId_teamId: { projectId, teamId } } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove team." };
  }
  revalidatePath(`/projects/${projectId}/forecast`);
  return { ok: true };
}
