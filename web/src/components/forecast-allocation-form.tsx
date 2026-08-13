"use client";

import { useActionState, useState } from "react";
import { FormError, NumberField, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import type { FormState } from "@/app/actions/forecast";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;
type Option = { id: number; name: string };

const MODES = [
  { value: "team", label: "Team", hint: "e.g. Mechanical Engineering = 12 FTE" },
  { value: "employee", label: "Employee", hint: "e.g. John Smith = 0.6 FTE" },
  { value: "skill", label: "Skill", hint: "e.g. Rotor Design = 1.2 FTE" },
] as const;

export function ForecastAllocationForm({
  action,
  refData,
  defaultScenarioId,
}: {
  action: Action;
  refData: {
    scenarios: Option[];
    projects: Option[];
    teams: Option[];
    employees: Option[];
    skills: Option[];
    resourceTypes: Option[];
    forecastSources: Option[];
    weeks: { dateKey: number; date: Date | string; weekNumber: number }[];
  };
  defaultScenarioId?: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [mode, setMode] = useState<"team" | "employee" | "skill">("team");
  const opts = (list: Option[]) => list.map((o) => ({ value: o.id, label: o.name }));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Planning mode (§ Forecasting Modes)
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                mode === m.value ? "border-slate-900 bg-slate-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mr-2"
              />
              <span className="font-medium text-slate-800">{m.label}</span>
              <p className="mt-0.5 text-xs text-slate-400">{m.hint}</p>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "team" ? (
        <SelectField name="teamId" label="Team" required options={opts(refData.teams)} />
      ) : null}
      {mode === "employee" ? (
        <SelectField name="employeeId" label="Employee" required options={opts(refData.employees)} />
      ) : null}
      {mode === "skill" ? (
        <SelectField name="skillId" label="Skill" required options={opts(refData.skills)} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField name="scenarioId" label="Scenario" required defaultValue={defaultScenarioId} options={opts(refData.scenarios)} />
        <SelectField name="projectId" label="Project" allowEmpty="— none —" options={opts(refData.projects)} />
        <SelectField name="forecastSourceId" label="Forecast source" required options={opts(refData.forecastSources)} />
        <SelectField name="resourceTypeId" label="Resource type" required options={opts(refData.resourceTypes)} />
        <SelectField
          name="dateKey"
          label="Week commencing"
          required
          options={refData.weeks.map((w) => ({
            value: w.dateKey,
            label: `Wk ${w.weekNumber} — ${new Date(w.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
          }))}
        />
        <NumberField name="hours" label="Hours (that week)" step="0.5" min={0} required />
      </div>

      <TextAreaField name="notes" label="Notes" />

      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : "Add allocation"}</SubmitButton>
      </div>
    </form>
  );
}
