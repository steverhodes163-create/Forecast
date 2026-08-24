// Shared presentational form fields. Every master-data form in the app
// renders through these instead of hand-styling inputs per page.
import type { ReactNode } from "react";

function FieldShell({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-accent disabled:bg-slate-50 disabled:text-slate-400";

export function TextField(props: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <FieldShell label={props.label} htmlFor={props.name}>
      <input
        id={props.name}
        name={props.name}
        type="text"
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        placeholder={props.placeholder}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function NumberField(props: {
  name: string;
  label: string;
  defaultValue?: number | string | null;
  required?: boolean;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <FieldShell label={props.label} htmlFor={props.name}>
      <input
        id={props.name}
        name={props.name}
        type="number"
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        step={props.step ?? "1"}
        min={props.min}
        max={props.max}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function DateField(props: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <FieldShell label={props.label} htmlFor={props.name}>
      <input
        id={props.name}
        name={props.name}
        type="date"
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function TextAreaField(props: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <FieldShell label={props.label} htmlFor={props.name}>
      <textarea
        id={props.name}
        name={props.name}
        defaultValue={props.defaultValue ?? ""}
        rows={2}
        className={inputClass}
      />
    </FieldShell>
  );
}

export function CheckboxField(props: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label htmlFor={props.name} className="flex items-center gap-2 text-sm">
      <input
        id={props.name}
        name={props.name}
        type="checkbox"
        defaultChecked={props.defaultChecked}
        className="h-4 w-4 rounded border-slate-300"
      />
      <span className="font-medium text-slate-700">{props.label}</span>
    </label>
  );
}

export function SelectField(props: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  required?: boolean;
  allowEmpty?: string;
  options: { value: string | number; label: string }[];
}) {
  return (
    <FieldShell label={props.label} htmlFor={props.name}>
      <select
        id={props.name}
        name={props.name}
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        className={inputClass}
      >
        {props.allowEmpty !== undefined ? <option value="">{props.allowEmpty}</option> : null}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent-hover"
    >
      {children}
    </button>
  );
}

export function DeleteButton({ children = "Delete" }: { children?: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  );
}
