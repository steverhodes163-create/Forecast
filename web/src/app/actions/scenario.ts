"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth";
import { SCENARIO_COOKIE_MAX_AGE, SCENARIO_COOKIE_NAME } from "@/lib/scenario";

export async function setActiveScenarioAction(formData: FormData) {
  const scenarioId = formData.get("globalScenarioId");
  const returnTo = String(formData.get("returnTo") ?? "/dashboard");
  if (scenarioId) {
    const store = await cookies();
    store.set(SCENARIO_COOKIE_NAME, String(scenarioId), {
      path: "/",
      maxAge: SCENARIO_COOKIE_MAX_AGE,
      httpOnly: false, // read only for defaulting a form's own scenario dropdown, never security-sensitive
      sameSite: "lax",
    });
  }
  redirect(returnTo);
}

// §7.4: "Baseline + adjustments" — a branch scenario has no rows of its own
// (see resolveScenarioSourceId in scenario.ts); it exists purely to hang
// ScenarioAdjustment rows off of without mutating the scenario everyone else
// is viewing. Created from the What-If page, immediately switched to.
export async function createScenarioBranchAction(formData: FormData) {
  const session = await getSession();
  if (!hasRole(session, ["ADMIN", "PMO"])) {
    redirect(`/what-if?error=${encodeURIComponent("You do not have permission to create a what-if scenario.")}`);
  }

  const name = String(formData.get("name") ?? "").trim();
  const baseScenarioId = Number(formData.get("baseScenarioId"));
  if (!name || !baseScenarioId) {
    redirect(`/what-if?error=${encodeURIComponent("A name and base scenario are required.")}`);
  }

  let newScenarioId: number;
  try {
    const created = await db.scenario.create({ data: { name, baseScenarioId, isActive: true, isLocked: false } });
    newScenarioId = created.id;
  } catch {
    redirect(`/what-if?error=${encodeURIComponent(`A scenario named "${name}" already exists.`)}`);
  }

  const store = await cookies();
  store.set(SCENARIO_COOKIE_NAME, String(newScenarioId), {
    path: "/",
    maxAge: SCENARIO_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
  });
  redirect("/what-if");
}
