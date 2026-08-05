// Config-driven CRUD for scalar-only lookup tables (dim_ProjectStatus, dim_Priority,
// dim_ForecastSource, etc. — the CFG_/MST_ "configuration" tables of the architecture
// doc, §4). One page template + one set of server actions serve all of them, so
// adding the next lookup table is a config entry, not a new set of files.
import { db } from "@/lib/db";

export type LookupFieldType = "text" | "textarea" | "number" | "decimal" | "boolean";

export type LookupField = {
  name: string;
  label: string;
  type: LookupFieldType;
  required?: boolean;
};

export type LookupDef = {
  key: string;
  label: string;
  description: string;
  fields: LookupField[];
};

export const LOOKUPS: LookupDef[] = [
  {
    key: "businessUnit",
    label: "Business Units",
    description: "dim_BusinessUnit — top of the organisation hierarchy (§5.1).",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "jobRole",
    label: "Job Roles",
    description: "dim_Role — job roles employees, contractors and requisitions are tagged with.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "disciplineCategory", label: "Discipline", type: "text" },
    ],
  },
  {
    key: "grade",
    label: "Grades",
    description: "dim_Grade.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "level", label: "Level (sort order)", type: "number", required: true },
    ],
  },
  {
    key: "employmentType",
    label: "Employment Types",
    description: "dim_EmploymentType — Permanent, Contractor, Agency, Graduate…",
    fields: [{ name: "name", label: "Name", type: "text", required: true }],
  },
  {
    key: "employeeStatus",
    label: "Employee Statuses",
    description: "dim_EmployeeStatus — Active, On Leave, Leaver, Future Starter.",
    fields: [{ name: "name", label: "Name", type: "text", required: true }],
  },
  {
    key: "skillCategory",
    label: "Skill Categories",
    description: "dim_SkillCategory.",
    fields: [{ name: "name", label: "Name", type: "text", required: true }],
  },
  {
    key: "resourceType",
    label: "Resource Types",
    description: "dim_ResourceType — Employee, Contractor, Agency, Graduate.",
    fields: [{ name: "name", label: "Name", type: "text", required: true }],
  },
  {
    key: "forecastSource",
    label: "Forecast Sources",
    description: "dim_ForecastSource — why capacity is consumed (§ Forecast Sources).",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "isProjectLinked", label: "Linked to a project", type: "boolean" },
    ],
  },
  {
    key: "recruitmentStatus",
    label: "Recruitment Statuses",
    description: "dim_RecruitmentStatus — the requisition pipeline stages.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "sortOrder", label: "Sort order", type: "number", required: true },
    ],
  },
  {
    key: "projectStatus",
    label: "Project Statuses",
    description: "dim_ProjectStatus — drives Weighted Demand (§7.1) via the default probability.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "defaultProbabilityPct", label: "Default probability %", type: "decimal", required: true },
      { name: "sortOrder", label: "Sort order", type: "number", required: true },
    ],
  },
  {
    key: "priority",
    label: "Priorities",
    description: "dim_Priority.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "sortOrder", label: "Sort order", type: "number", required: true },
    ],
  },
  {
    key: "adjustmentType",
    label: "What-If Adjustment Types",
    description: "dim_AdjustmentType — Delay, Cancel, Win, New Hire… used by the scenario what-if engine (§7.4).",
    fields: [{ name: "name", label: "Name", type: "text", required: true }],
  },
  {
    key: "customer",
    label: "Customers",
    description: "dim_Customer.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "workingCalendar",
    label: "Working Calendars",
    description: "dim_WorkingCalendar — standard hours by country/site.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "standardWeeklyHours", label: "Standard weekly hours", type: "decimal", required: true },
      { name: "countryCode", label: "Country code", type: "text", required: true },
    ],
  },
];

export function getLookupDef(key: string): LookupDef | undefined {
  return LOOKUPS.find((l) => l.key === key);
}

// A single accessor keyed by table name. `any` is contained to this one file:
// each Prisma delegate has a distinct generated type, and the point of this
// module is to treat them uniformly for a generic scalar-field CRUD page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function delegate(key: string): any {
  const d = (db as unknown as Record<string, unknown>)[key];
  if (!d) throw new Error(`Unknown lookup table: ${key}`);
  return d;
}

export function coerceFormData(def: LookupDef, formData: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.type === "boolean") {
      data[field.name] = formData.get(field.name) === "on";
      continue;
    }
    const raw = formData.get(field.name);
    if (raw === null || raw === "") {
      if (field.required) throw new Error(`${field.label} is required`);
      data[field.name] = null;
      continue;
    }
    if (field.type === "number") data[field.name] = parseInt(String(raw), 10);
    else if (field.type === "decimal") data[field.name] = String(raw);
    else data[field.name] = String(raw);
  }
  return data;
}

export async function listLookupRows(key: string) {
  return delegate(key).findMany({ orderBy: { id: "asc" } });
}

export async function getLookupRow(key: string, id: number) {
  return delegate(key).findUnique({ where: { id } });
}

export async function createLookupRow(key: string, data: Record<string, unknown>) {
  return delegate(key).create({ data });
}

export async function updateLookupRow(key: string, id: number, data: Record<string, unknown>) {
  return delegate(key).update({ where: { id }, data });
}

export async function deleteLookupRow(key: string, id: number) {
  return delegate(key).delete({ where: { id } });
}
