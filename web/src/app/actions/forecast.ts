"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "ENGINEERING_LEAD"])) {
    throw new Error("You do not have permission to enter forecast allocations.");
  }
}

function requiredInt(formData: FormData, name: string, label: string): number {
  const raw = formData.get(name);
  if (!raw) throw new Error(`${label} is required.`);
  return parseInt(String(raw), 10);
}

function optionalInt(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (!raw) return null;
  return parseInt(String(raw), 10);
}

// fact_ForecastAllocation is polymorphic on planning mode (§3, §17 #1 of the
// architecture doc): exactly one of employeeId/teamId/skillId is populated,
// matching whichever of the three modes (Team / Employee / Skill) this row
// was entered in. The `mode` form field selects which FK to populate.
export async function createForecastAllocationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    const mode = String(formData.get("mode") ?? "");
    if (!["team", "employee", "skill"].includes(mode)) throw new Error("Choose a planning mode.");

    const hoursRaw = formData.get("hours");
    if (!hoursRaw || Number(hoursRaw) <= 0) throw new Error("Hours must be greater than zero.");

    const data: {
      scenarioId: number;
      projectId: number | null;
      employeeId: number | null;
      teamId: number | null;
      skillId: number | null;
      resourceTypeId: number;
      forecastSourceId: number;
      dateKey: number;
      hours: string;
      notes: string | null;
    } = {
      scenarioId: requiredInt(formData, "scenarioId", "Scenario"),
      projectId: optionalInt(formData, "projectId"),
      employeeId: mode === "employee" ? requiredInt(formData, "employeeId", "Employee") : null,
      teamId: mode === "team" ? requiredInt(formData, "teamId", "Team") : null,
      skillId: mode === "skill" ? requiredInt(formData, "skillId", "Skill") : null,
      resourceTypeId: requiredInt(formData, "resourceTypeId", "Resource type"),
      forecastSourceId: requiredInt(formData, "forecastSourceId", "Forecast source"),
      dateKey: requiredInt(formData, "dateKey", "Week"),
      hours: String(hoursRaw),
      notes: formData.get("notes") ? String(formData.get("notes")) : null,
    };

    await db.forecastAllocation.create({ data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create forecast allocation." };
  }
  revalidatePath("/forecast");
  redirect("/forecast");
}

export async function deleteForecastAllocationAction(formData: FormData) {
  const id = Number(formData.get("id"));
  await requireEditor();
  await db.forecastAllocation.delete({ where: { id } });
  revalidatePath("/forecast");
  redirect("/forecast");
}
