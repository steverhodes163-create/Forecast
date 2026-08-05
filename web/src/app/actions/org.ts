"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "HR"])) {
    throw new Error("You do not have permission to edit this data.");
  }
}

function optionalInt(formData: FormData, name: string): number | undefined {
  const raw = formData.get(name);
  if (raw === null || raw === "") return undefined;
  return parseInt(String(raw), 10);
}

// --- Departments ------------------------------------------------------

async function departmentPayload(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const businessUnitId = optionalInt(formData, "businessUnitId");
  if (!name) throw new Error("Name is required.");
  if (!businessUnitId) throw new Error("Business unit is required.");
  return { name, businessUnitId };
}

export async function createDepartmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    await db.department.create({ data: await departmentPayload(formData) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create department." };
  }
  revalidatePath("/departments");
  redirect("/departments");
}

export async function updateDepartmentAction(
  id: number,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await requireEditor();
    await db.department.update({ where: { id }, data: await departmentPayload(formData) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update department." };
  }
  revalidatePath("/departments");
  redirect("/departments");
}

export async function deleteDepartmentAction(formData: FormData) {
  const id = Number(formData.get("id"));
  try {
    await requireEditor();
    await db.department.delete({ where: { id } });
  } catch {
    redirect(`/departments?error=${encodeURIComponent("Could not delete — this department is still in use.")}`);
  }
  revalidatePath("/departments");
  redirect("/departments");
}

// --- Teams --------------------------------------------------------------

async function teamPayload(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const departmentId = optionalInt(formData, "departmentId");
  const managerEmployeeId = optionalInt(formData, "managerEmployeeId") ?? null;
  const budgetedHeadcountRaw = formData.get("budgetedHeadcount");
  if (!name) throw new Error("Name is required.");
  if (!departmentId) throw new Error("Department is required.");
  return {
    name,
    departmentId,
    managerEmployeeId,
    budgetedHeadcount: budgetedHeadcountRaw ? String(budgetedHeadcountRaw) : null,
  };
}

export async function createTeamAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    await db.team.create({ data: await teamPayload(formData) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create team." };
  }
  revalidatePath("/teams");
  redirect("/teams");
}

export async function updateTeamAction(id: number, _prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    await db.team.update({ where: { id }, data: await teamPayload(formData) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update team." };
  }
  revalidatePath("/teams");
  redirect("/teams");
}

export async function deleteTeamAction(formData: FormData) {
  const id = Number(formData.get("id"));
  try {
    await requireEditor();
    await db.team.delete({ where: { id } });
  } catch {
    redirect(`/teams?error=${encodeURIComponent("Could not delete — this team is still in use.")}`);
  }
  revalidatePath("/teams");
  redirect("/teams");
}
