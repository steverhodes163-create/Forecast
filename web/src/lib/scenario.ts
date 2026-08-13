// The global "which scenario am I looking at" state (§ Scenarios — "Users
// should switch scenarios using a simple selector"). Stored as a cookie so
// every server component/measure function picks it up without prop drilling
// a scenario id through every dashboard.
import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE_NAME = "yasa_scenario_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export { COOKIE_NAME as SCENARIO_COOKIE_NAME, COOKIE_MAX_AGE as SCENARIO_COOKIE_MAX_AGE };

async function fallbackScenario() {
  return (
    (await db.scenario.findFirst({ where: { name: "Baseline" } })) ??
    (await db.scenario.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }))
  );
}

/** The scenario currently selected for viewing — respects a locked scenario (e.g. "Budget") too; locking only blocks edits, not viewing. */
export async function getActiveScenario() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const requestedId = raw ? Number(raw) : null;

  if (requestedId) {
    const scenario = await db.scenario.findUnique({ where: { id: requestedId } });
    if (scenario) return scenario;
  }
  return fallbackScenario();
}

export async function getActiveScenarioId(): Promise<number | null> {
  const scenario = await getActiveScenario();
  return scenario?.id ?? null;
}

export async function listAllScenarios() {
  return db.scenario.findMany({ orderBy: { name: "asc" } });
}
