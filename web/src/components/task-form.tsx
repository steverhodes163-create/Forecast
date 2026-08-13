"use client";

import { useActionState, useState } from "react";
import { TextField, NumberField, DateField, TextAreaField, FormError, SubmitButton } from "@/components/form";
import type { FormState } from "@/app/actions/tasks";

type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;

export function TaskForm({
  action,
  projectId,
  otherTasks,
  employees,
  defaults,
  submitLabel = "Add task",
}: {
  action: Action;
  projectId: number;
  otherTasks: { id: number; name: string }[];
  employees: { id: number; name: string }[];
  defaults?: {
    name?: string;
    durationDays?: number;
    manualStartDate?: string | null;
    notes?: string | null;
    dependsOn?: number[];
    assignees?: { employeeId: number; fte: number }[];
  };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [checkedAssignees, setCheckedAssignees] = useState<Set<number>>(new Set(defaults?.assignees?.map((a) => a.employeeId) ?? []));

  function toggleAssignee(id: number) {
    setCheckedAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const defaultFteFor = (employeeId: number) => defaults?.assignees?.find((a) => a.employeeId === employeeId)?.fte ?? 1;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="projectId" value={projectId} />
      <TextField name="name" label="Task name" required defaultValue={defaults?.name} />
      <div className="grid grid-cols-2 gap-4">
        <NumberField name="durationDays" label="Duration (working days)" min={1} required defaultValue={defaults?.durationDays ?? 1} />
        <DateField name="manualStartDate" label="Start no earlier than (optional)" defaultValue={defaults?.manualStartDate} />
      </div>
      <TextAreaField name="notes" label="Notes" defaultValue={defaults?.notes} />

      {otherTasks.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Depends on (must finish first)</legend>
          <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-2">
            {otherTasks.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="dependsOn"
                  value={t.id}
                  defaultChecked={defaults?.dependsOn?.includes(t.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-slate-700">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned to</legend>
        <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-2">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="assignee"
                value={e.id}
                checked={checkedAssignees.has(e.id)}
                onChange={() => toggleAssignee(e.id)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="flex-1 text-slate-700">{e.name}</span>
              {checkedAssignees.has(e.id) ? (
                <input
                  type="number"
                  name={`fte_${e.id}`}
                  step="0.1"
                  min="0.1"
                  max="1"
                  defaultValue={defaultFteFor(e.id)}
                  title="FTE share of this task"
                  className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs outline-none focus:border-slate-500"
                />
              ) : null}
            </div>
          ))}
        </div>
      </fieldset>

      <FormError message={state?.error} />
      <div>
        <SubmitButton>{pending ? "Saving…" : submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
