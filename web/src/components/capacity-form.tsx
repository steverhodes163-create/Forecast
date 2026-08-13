"use client";

import { useActionState } from "react";
import { FormError, NumberField, SelectField, SubmitButton } from "@/components/form";
import type { FormState } from "@/app/actions/capacity";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;
type Option = { id: number; name: string };

const HEADCOUNT_FIELDS = [
  { name: "budgetedHeadcount", label: "Budgeted headcount" },
  { name: "actualHeadcount", label: "Actual headcount" },
  { name: "vacancies", label: "Vacancies" },
  { name: "contractorsCount", label: "Contractors" },
  { name: "agencyCount", label: "Agency" },
  { name: "graduateIntakeCount", label: "Graduate intake" },
  { name: "futureHiresCount", label: "Future hires" },
  { name: "leaversCount", label: "Leavers" },
] as const;

const HOURS_FIELDS = [
  { name: "standardHours", label: "Standard hours" },
  { name: "trainingHours", label: "Training" },
  { name: "businessShutdownHours", label: "Business shutdown" },
  { name: "holidayHours", label: "Holiday" },
  { name: "internalMeetingHours", label: "Internal meetings" },
  { name: "bauAllowanceHours", label: "BAU allowance" },
  { name: "managementOverheadHours", label: "Management overhead" },
] as const;

export function CapacityForm({
  action,
  teams,
  scenarios,
  defaultScenarioId,
}: {
  action: Action;
  teams: Option[];
  scenarios: Option[];
  defaultScenarioId?: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField name="teamId" label="Team" required options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        <SelectField
          name="scenarioId"
          label="Scenario"
          required
          defaultValue={defaultScenarioId}
          options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Month</span>
          <input
            type="month"
            name="month"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Headcount</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HEADCOUNT_FIELDS.map((f) => (
            <NumberField key={f.name} name={f.name} label={f.label} step="0.5" defaultValue="0" />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Hours (§7.2 Available Hours = Standard − the rest)
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HOURS_FIELDS.map((f) => (
            <NumberField key={f.name} name={f.name} label={f.label} step="0.5" defaultValue="0" />
          ))}
        </div>
      </fieldset>

      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : "Save capacity"}</SubmitButton>
      </div>
    </form>
  );
}
