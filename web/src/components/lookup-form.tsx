"use client";

import { useActionState } from "react";
import type { LookupDef } from "@/lib/lookups";
import type { LookupFormState } from "@/app/actions/lookups";
import { CheckboxField, FormError, NumberField, SubmitButton, TextAreaField, TextField } from "@/components/form";

type LookupAction = (prevState: LookupFormState, formData: FormData) => Promise<LookupFormState>;

export function LookupForm({
  def,
  action,
  defaults,
  submitLabel,
}: {
  def: LookupDef;
  action: LookupAction;
  defaults?: Record<string, unknown>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<LookupFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {def.fields.map((field) => {
        const value = defaults?.[field.name];
        if (field.type === "boolean") {
          return <CheckboxField key={field.name} name={field.name} label={field.label} defaultChecked={Boolean(value)} />;
        }
        if (field.type === "textarea") {
          return <TextAreaField key={field.name} name={field.name} label={field.label} defaultValue={value == null ? null : String(value)} />;
        }
        if (field.type === "number" || field.type === "decimal") {
          return (
            <NumberField
              key={field.name}
              name={field.name}
              label={field.label}
              defaultValue={value == null ? "" : String(value)}
              required={field.required}
              step={field.type === "decimal" ? "0.01" : "1"}
            />
          );
        }
        return (
          <TextField
            key={field.name}
            name={field.name}
            label={field.label}
            defaultValue={value == null ? null : String(value)}
            required={field.required}
          />
        );
      })}
      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
