"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
