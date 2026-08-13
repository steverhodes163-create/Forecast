"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";

type ActionResult = { ok: true } | { error: string };

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "ENGINEERING_LEAD"])) {
    throw new Error("You do not have permission to enter forecast allocations.");
  }
}

// The grid always writes employee-mode rows tagged as project-linked work,
// so it never collides with (and never overwrites) a manually-entered row
// for the same employee/week logged against a different ForecastSource
// (e.g. "Annual Leave", "BAU") -- see the `gridCell` unique constraint on
// ForecastAllocation, which is scoped by resourceTypeId + forecastSourceId.
let cachedGridDefaults: { resourceTypeId: number; forecastSourceId: number } | null = null;
async function gridDefaults() {
  if (cachedGridDefaults) return cachedGridDefaults;
  const [resourceType, forecastSource] = await Promise.all([
    db.resourceType.findFirstOrThrow({ where: { name: "Employee" } }),
    db.forecastSource.findFirstOrThrow({ where: { name: "Project" } }),
  ]);
  cachedGridDefaults = { resourceTypeId: resourceType.id, forecastSourceId: forecastSource.id };
  return cachedGridDefaults;
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
