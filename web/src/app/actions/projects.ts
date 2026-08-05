"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO"])) {
    throw new Error("You do not have permission to edit project data.");
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

function optionalDecimal(formData: FormData, name: string): string | null {
  const raw = formData.get(name);
  if (raw === null || raw === "") return null;
  return String(raw);
}

function optionalText(formData: FormData, name: string): string | null {
  const raw = formData.get(name);
  if (raw === null || String(raw).trim() === "") return null;
  return String(raw);
}

function optionalDate(formData: FormData, name: string): Date | null {
  const raw = formData.get(name);
  if (!raw) return null;
  return new Date(String(raw));
}

async function projectPayload(formData: FormData) {
  return {
    name: optionalText(formData, "name") ?? (() => { throw new Error("Name is required."); })(),
    customerId: requiredInt(formData, "customerId", "Customer"),
    programmeId: optionalInt(formData, "programmeId"),
    projectManagerEmployeeId: optionalInt(formData, "projectManagerEmployeeId"),
    businessUnitId: requiredInt(formData, "businessUnitId", "Business unit"),
    priorityId: requiredInt(formData, "priorityId", "Priority"),
    projectStatusId: requiredInt(formData, "projectStatusId", "Status"),
    lifecyclePhase: optionalText(formData, "lifecyclePhase"),
    probabilityOverridePct: optionalDecimal(formData, "probabilityOverridePct"),
    startDate: optionalDate(formData, "startDate"),
    finishDate: optionalDate(formData, "finishDate"),
    revenueForecast: optionalDecimal(formData, "revenueForecast"),
    budgetCost: optionalDecimal(formData, "budgetCost"),
    targetMarginPct: optionalDecimal(formData, "targetMarginPct"),
    strategicImportance: formData.get("strategicImportance") === "on",
    ragStatus: optionalText(formData, "ragStatus"),
    gateway: optionalText(formData, "gateway"),
    technology: optionalText(formData, "technology"),
    platform: optionalText(formData, "platform"),
    costCentreId: optionalInt(formData, "costCentreId"),
    notes: optionalText(formData, "notes"),
  };
}

export async function createProjectAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    await db.project.create({ data: await projectPayload(formData) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create project." };
  }
  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProjectAction(id: number, _prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    await db.project.update({ where: { id }, data: await projectPayload(formData) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update project." };
  }
  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteProjectAction(formData: FormData) {
  const id = Number(formData.get("id"));
  try {
    await requireEditor();
    await db.project.delete({ where: { id } });
  } catch {
    redirect(`/projects?error=${encodeURIComponent("Could not delete — this project has linked forecast/actual records.")}`);
  }
  revalidatePath("/projects");
  redirect("/projects");
}
