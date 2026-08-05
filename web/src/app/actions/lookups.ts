"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, hasRole } from "@/lib/auth";
import { coerceFormData, createLookupRow, deleteLookupRow, getLookupDef, updateLookupRow } from "@/lib/lookups";

export type LookupFormState = { error?: string } | undefined;

async function requireEditor() {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO", "HR"])) {
    throw new Error("You do not have permission to edit configuration data.");
  }
}

export async function createLookupAction(
  key: string,
  _prevState: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  const def = getLookupDef(key);
  if (!def) return { error: "Unknown table." };
  try {
    await requireEditor();
    const data = coerceFormData(def, formData);
    await createLookupRow(key, data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create row." };
  }
  revalidatePath(`/settings/${key}`);
  redirect(`/settings/${key}`);
}

export async function updateLookupAction(
  key: string,
  id: number,
  _prevState: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  const def = getLookupDef(key);
  if (!def) return { error: "Unknown table." };
  try {
    await requireEditor();
    const data = coerceFormData(def, formData);
    await updateLookupRow(key, id, data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update row." };
  }
  revalidatePath(`/settings/${key}`);
  redirect(`/settings/${key}`);
}

export async function deleteLookupAction(formData: FormData) {
  const key = String(formData.get("key"));
  const id = Number(formData.get("id"));
  try {
    await requireEditor();
    await deleteLookupRow(key, id);
  } catch {
    redirect(
      `/settings/${key}?error=${encodeURIComponent("Could not delete this row — it may still be in use, or you may not have permission.")}`
    );
  }
  revalidatePath(`/settings/${key}`);
  redirect(`/settings/${key}`);
}
