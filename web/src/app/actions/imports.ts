"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, hasRole } from "@/lib/auth";
import { importTimesheetCsv } from "@/lib/imports";

export type FormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "FINANCE"])) {
    throw new Error("You do not have permission to import timesheet data.");
  }
}

export async function uploadTimesheetAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  let batchId: number;
  try {
    await requireEditor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a CSV file first." };
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return { error: "Only .csv files are supported." };
    }
    const text = await file.text();
    const result = await importTimesheetCsv(file.name, text);
    batchId = result.batchId;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
  revalidatePath("/imports");
  redirect(`/imports/${batchId}`);
}
