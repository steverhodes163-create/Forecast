"use client";

import { useActionState } from "react";
import {
  CheckboxField,
  DateField,
  FormError,
  NumberField,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/form";
import type { FormState } from "@/app/actions/projects";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;
type Option = { id: number; name: string };

function isoDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

const RAG_OPTIONS = [
  { value: "Green", label: "Green" },
  { value: "Amber", label: "Amber" },
  { value: "Red", label: "Red" },
];

export function ProjectForm({
  action,
  refData,
  defaults,
  submitLabel,
}: {
  action: Action;
  refData: {
    customers: Option[];
    programmes: Option[];
    businessUnits: Option[];
    priorities: Option[];
    statuses: Option[];
    employees: Option[];
    costCentres: Option[];
  };
  defaults?: Record<string, unknown>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const opts = (list: Option[]) => list.map((o) => ({ value: o.id, label: o.name }));

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Identity</h3>
        <div className="sm:col-span-2">
          <TextField name="name" label="Project name" defaultValue={defaults?.name as string} required />
        </div>
        <SelectField
          name="customerId"
          label="Customer"
          required
          defaultValue={defaults?.customerId as number | undefined}
          options={opts(refData.customers)}
        />
        <SelectField
          name="programmeId"
          label="Programme"
          allowEmpty="— none —"
          defaultValue={defaults?.programmeId as number | undefined}
          options={opts(refData.programmes)}
        />
        <SelectField
          name="businessUnitId"
          label="Business unit"
          required
          defaultValue={defaults?.businessUnitId as number | undefined}
          options={opts(refData.businessUnits)}
        />
        <SelectField
          name="projectManagerEmployeeId"
          label="Project manager"
          allowEmpty="— none —"
          defaultValue={defaults?.projectManagerEmployeeId as number | undefined}
          options={opts(refData.employees)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">
          Status &amp; probability
        </h3>
        <SelectField
          name="projectStatusId"
          label="Status"
          required
          defaultValue={defaults?.projectStatusId as number | undefined}
          options={opts(refData.statuses)}
        />
        <SelectField
          name="priorityId"
          label="Priority"
          required
          defaultValue={defaults?.priorityId as number | undefined}
          options={opts(refData.priorities)}
        />
        <SelectField name="ragStatus" label="RAG status" allowEmpty="— none —" defaultValue={defaults?.ragStatus as string} options={RAG_OPTIONS} />
        <NumberField
          name="probabilityOverridePct"
          label="Probability override %"
          step="1"
          min={0}
          max={100}
          defaultValue={defaults?.probabilityOverridePct as string}
        />
        <TextField name="lifecyclePhase" label="Lifecycle phase" defaultValue={defaults?.lifecyclePhase as string} />
        <div className="flex items-end pb-2">
          <CheckboxField name="strategicImportance" label="Strategically important" defaultChecked={Boolean(defaults?.strategicImportance)} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Schedule</h3>
        <DateField name="startDate" label="Start date" defaultValue={isoDate(defaults?.startDate as string)} />
        <DateField name="finishDate" label="Finish date" defaultValue={isoDate(defaults?.finishDate as string)} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Financials</h3>
        <NumberField name="revenueForecast" label="Revenue forecast (£)" step="1" defaultValue={defaults?.revenueForecast as string} />
        <NumberField name="budgetCost" label="Budget cost (£)" step="1" defaultValue={defaults?.budgetCost as string} />
        <NumberField name="targetMarginPct" label="Target margin %" step="0.1" defaultValue={defaults?.targetMarginPct as string} />
        <SelectField
          name="costCentreId"
          label="Cost centre"
          allowEmpty="— none —"
          defaultValue={defaults?.costCentreId as number | undefined}
          options={opts(refData.costCentres)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Technical &amp; notes</h3>
        <TextField name="gateway" label="Gateway" defaultValue={defaults?.gateway as string} />
        <TextField name="technology" label="Technology" defaultValue={defaults?.technology as string} />
        <TextField name="platform" label="Platform" defaultValue={defaults?.platform as string} />
        <div className="sm:col-span-2 lg:col-span-3">
          <TextAreaField name="notes" label="Notes" defaultValue={defaults?.notes as string} />
        </div>
      </section>

      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
