"use client";

import { useActionState } from "react";
import { FormError, SelectField, SubmitButton, TextField } from "@/components/form";
import type { FormState } from "@/app/actions/org";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;

export function DepartmentForm({
  action,
  businessUnits,
  defaults,
  submitLabel,
}: {
  action: Action;
  businessUnits: { id: number; name: string }[];
  defaults?: { name?: string; businessUnitId?: number };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField name="name" label="Name" defaultValue={defaults?.name} required />
      <SelectField
        name="businessUnitId"
        label="Business unit"
        required
        defaultValue={defaults?.businessUnitId}
        options={businessUnits.map((b) => ({ value: b.id, label: b.name }))}
      />
      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
