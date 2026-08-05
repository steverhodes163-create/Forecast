"use client";

import { useActionState } from "react";
import { DateField, FormError, NumberField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form";
import type { FormState } from "@/app/actions/employees";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;
type Option = { id: number; name: string };

function isoDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function EmployeeForm({
  action,
  refData,
  defaults,
  submitLabel,
}: {
  action: Action;
  refData: {
    departments: Option[];
    teams: Option[];
    jobRoles: Option[];
    grades: Option[];
    employmentTypes: Option[];
    locations: Option[];
    workingCalendars: Option[];
    statuses: Option[];
    employees: Option[];
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
        <TextField name="name" label="Full name" defaultValue={defaults?.name as string} required />
        <SelectField
          name="managerEmployeeId"
          label="Manager"
          allowEmpty="— none —"
          defaultValue={defaults?.managerEmployeeId as number | undefined}
          options={opts(refData.employees)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Organisation</h3>
        <SelectField
          name="departmentId"
          label="Department"
          required
          defaultValue={defaults?.departmentId as number | undefined}
          options={opts(refData.departments)}
        />
        <SelectField
          name="teamId"
          label="Team"
          allowEmpty="— none —"
          defaultValue={defaults?.teamId as number | undefined}
          options={opts(refData.teams)}
        />
        <SelectField
          name="jobRoleId"
          label="Job role"
          required
          defaultValue={defaults?.jobRoleId as number | undefined}
          options={opts(refData.jobRoles)}
        />
        <SelectField
          name="gradeId"
          label="Grade"
          allowEmpty="— none —"
          defaultValue={defaults?.gradeId as number | undefined}
          options={opts(refData.grades)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Employment</h3>
        <SelectField
          name="employmentTypeId"
          label="Employment type"
          required
          defaultValue={defaults?.employmentTypeId as number | undefined}
          options={opts(refData.employmentTypes)}
        />
        <SelectField
          name="statusId"
          label="Status"
          required
          defaultValue={defaults?.statusId as number | undefined}
          options={opts(refData.statuses)}
        />
        <SelectField
          name="locationId"
          label="Location"
          required
          defaultValue={defaults?.locationId as number | undefined}
          options={opts(refData.locations)}
        />
        <SelectField
          name="workingCalendarId"
          label="Working calendar"
          required
          defaultValue={defaults?.workingCalendarId as number | undefined}
          options={opts(refData.workingCalendars)}
        />
        <DateField name="employmentStartDate" label="Employment start" required defaultValue={isoDate(defaults?.employmentStartDate as string)} />
        <DateField name="employmentEndDate" label="Employment end" defaultValue={isoDate(defaults?.employmentEndDate as string)} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Time &amp; cost</h3>
        <NumberField name="contractHoursPerWeek" label="Contract hours/week" step="0.5" required defaultValue={defaults?.contractHoursPerWeek as string} />
        <NumberField name="standardWeeklyHours" label="Standard weekly hours" step="0.5" required defaultValue={defaults?.standardWeeklyHours as string} />
        <NumberField name="fte" label="FTE" step="0.01" min={0} max={1} required defaultValue={defaults?.fte as string} />
        <NumberField name="costRate" label="Cost rate (£/hr)" step="0.01" required defaultValue={defaults?.costRate as string} />
        <NumberField name="chargeRate" label="Charge rate (£/hr)" step="0.01" defaultValue={defaults?.chargeRate as string} />
        <NumberField name="utilisationTargetPct" label="Utilisation target %" step="0.1" defaultValue={defaults?.utilisationTargetPct as string} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-400">Allowances &amp; notes</h3>
        <NumberField name="holidayAllowanceDays" label="Holiday allowance (days)" step="0.5" defaultValue={defaults?.holidayAllowanceDays as string} />
        <NumberField name="trainingAllowanceDays" label="Training allowance (days)" step="0.5" defaultValue={defaults?.trainingAllowanceDays as string} />
        <div className="sm:col-span-2">
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
