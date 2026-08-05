"use client";

import { useActionState } from "react";
import { FormError, NumberField, SelectField, SubmitButton, TextField } from "@/components/form";
import type { FormState } from "@/app/actions/org";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;

export function TeamForm({
  action,
  departments,
  employees,
  defaults,
  submitLabel,
}: {
  action: Action;
  departments: { id: number; name: string }[];
  employees: { id: number; name: string }[];
  defaults?: { name?: string; departmentId?: number; managerEmployeeId?: number | null; budgetedHeadcount?: string | null };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField name="name" label="Name" defaultValue={defaults?.name} required />
      <SelectField
        name="departmentId"
        label="Department"
        required
        defaultValue={defaults?.departmentId}
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />
      <SelectField
        name="managerEmployeeId"
        label="Manager"
        allowEmpty="— none —"
        defaultValue={defaults?.managerEmployeeId ?? ""}
        options={employees.map((e) => ({ value: e.id, label: e.name }))}
      />
      <NumberField name="budgetedHeadcount" label="Budgeted headcount" step="0.5" defaultValue={defaults?.budgetedHeadcount ?? ""} />
      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
