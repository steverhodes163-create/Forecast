"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/form";
import type { FormState } from "@/app/actions/imports";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;

export function TimesheetUploadForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Timesheet CSV</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
        />
      </label>
      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Importing…" : "Upload and import"}</SubmitButton>
      </div>
    </form>
  );
}
