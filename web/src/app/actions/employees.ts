"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "HR"])) {
    throw new Error("You do not have permission to edit employee data.");
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

function requiredDecimal(formData: FormData, name: string, label: string): string {
  const raw = formData.get(name);
  if (raw === null || raw === "") throw new Error(`${label} is required.`);
  return String(raw);
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

function requiredDate(formData: FormData, name: string, label: string): Date {
  const raw = formData.get(name);
  if (!raw) throw new Error(`${label} is required.`);
  return new Date(String(raw));
}

function optionalDate(formData: FormData, name: string): Date | null {
  const raw = formData.get(name);
  if (!raw) return null;
  return new Date(String(raw));
}

async function employeePayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim() || (() => { throw new Error("Name is required."); })(),
    managerEmployeeId: optionalInt(formData, "managerEmployeeId"),
    departmentId: requiredInt(formData, "departmentId", "Department"),
    teamId: optionalInt(formData, "teamId"),
    jobRoleId: requiredInt(formData, "jobRoleId", "Job role"),
    gradeId: optionalInt(formData, "gradeId"),
    employmentTypeId: requiredInt(formData, "employmentTypeId", "Employment type"),
    locationId: requiredInt(formData, "locationId", "Location"),
    workingCalendarId: requiredInt(formData, "workingCalendarId", "Working calendar"),
    contractHoursPerWeek: requiredDecimal(formData, "contractHoursPerWeek", "Contract hours/week"),
    standardWeeklyHours: requiredDecimal(formData, "standardWeeklyHours", "Standard weekly hours"),
    fte: requiredDecimal(formData, "fte", "FTE"),
    costRate: requiredDecimal(formData, "costRate", "Cost rate"),
    chargeRate: optionalDecimal(formData, "chargeRate"),
    employmentStartDate: requiredDate(formData, "employmentStartDate", "Employment start date"),
    employmentEndDate: optionalDate(formData, "employmentEndDate"),
    statusId: requiredInt(formData, "statusId", "Status"),
    holidayAllowanceDays: optionalDecimal(formData, "holidayAllowanceDays"),
    trainingAllowanceDays: optionalDecimal(formData, "trainingAllowanceDays"),
    utilisationTargetPct: optionalDecimal(formData, "utilisationTargetPct"),
    notes: optionalText(formData, "notes"),
  };
}

export async function createEmployeeAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    const data = await employeePayload(formData);
    await db.employee.create({ data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create employee." };
  }
  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployeeAction(id: number, _prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();
    const data = await employeePayload(formData);
    await db.employee.update({ where: { id }, data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update employee." };
  }
  revalidatePath("/employees");
  redirect("/employees");
}

export async function deleteEmployeeAction(formData: FormData) {
  const id = Number(formData.get("id"));
  try {
    await requireEditor();
    await db.employee.delete({ where: { id } });
  } catch {
    redirect(`/employees?error=${encodeURIComponent("Could not delete — this employee has linked records (allocations, skills, etc).")}`);
  }
  revalidatePath("/employees");
  redirect("/employees");
}
