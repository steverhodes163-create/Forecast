"use client";

import { usePathname } from "next/navigation";
import { setActiveScenarioAction } from "@/app/actions/scenario";

export function ScenarioSwitcher({ scenarios, activeId }: { scenarios: { id: number; name: string; isLocked: boolean }[]; activeId: number | null }) {
  const pathname = usePathname();

  return (
    <form
      action={setActiveScenarioAction}
      className="flex items-center gap-1.5"
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="returnTo" value={pathname} />
      <label htmlFor="global-scenario-switcher" className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Scenario
      </label>
      <select
        id="global-scenario-switcher"
        name="globalScenarioId"
        defaultValue={activeId ?? undefined}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.isLocked ? " (locked)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
