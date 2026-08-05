"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";
import { buildCalendarDateRow } from "@/lib/calendar";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "ENGINEERING_LEAD"])) {
    throw new Error("You do not have permission to enter capacity data.");
  }
}

function requiredInt(formData: FormData, name: string, label: string): number {
  const raw = formData.get(name);
  if (!raw) throw new Error(`${label} is required.`);
  return parseInt(String(raw), 10);
}

function decimalOrZero(formData: FormData, name: string): string {
  const raw = formData.get(name);
  if (raw === null || raw === "") return "0";
  return String(raw);
}

const HOURS_AND_HEADCOUNT_FIELDS = [
  "budgetedHeadcount",
  "actualHeadcount",
  "vacancies",
  "contractorsCount",
  "agencyCount",
  "graduateIntakeCount",
  "futureHiresCount",
  "leaversCount",
  "standardHours",
  "trainingHours",
  "businessShutdownHours",
  "holidayHours",
  "internalMeetingHours",
  "bauAllowanceHours",
  "managementOverheadHours",
] as const;

export async function createCapacityAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireEditor();

    const teamId = requiredInt(formData, "teamId", "Team");
    const scenarioId = requiredInt(formData, "scenarioId", "Scenario");
    const monthRaw = String(formData.get("month") ?? "");
    if (!monthRaw) throw new Error("Month is required.");
    const [year, month] = monthRaw.split("-").map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));

    // Capacity's grain is monthly (§5.2); ensure the dim_Calendar row for the
    // 1st of the selected month exists rather than requiring it pre-seeded.
    const calendarRow = buildCalendarDateRow(monthStart);
    await db.calendarDate.upsert({
      where: { dateKey: calendarRow.dateKey },
      update: {},
      create: calendarRow,
    });

    const values = Object.fromEntries(
      HOURS_AND_HEADCOUNT_FIELDS.map((f) => [f, decimalOrZero(formData, f)])
    ) as Record<(typeof HOURS_AND_HEADCOUNT_FIELDS)[number], string>;

    await db.capacity.upsert({
      where: { teamId_scenarioId_dateKey: { teamId, scenarioId, dateKey: calendarRow.dateKey } },
      update: values,
      create: { teamId, scenarioId, dateKey: calendarRow.dateKey, ...values },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save capacity." };
  }
  revalidatePath("/capacity");
  redirect("/capacity");
}

export async function deleteCapacityAction(formData: FormData) {
  const id = Number(formData.get("id"));
  await requireEditor();
  await db.capacity.delete({ where: { id } });
  revalidatePath("/capacity");
  redirect("/capacity");
}
