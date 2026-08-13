"use client";

export type FilterDef = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

// A plain GET form -- filtering is just the URL's search params, so results
// are shareable/bookmarkable and no client state is needed beyond the
// auto-submit-on-change convenience. Multiple selects share one form so
// changing one filter preserves the others' current values.
export function DashboardFilterBar({ filters }: { filters: FilterDef[] }) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filter</span>
      {filters.map((f) => (
        <label key={f.name} className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-500">{f.label}</span>
          <select
            name={f.name}
            defaultValue={f.value}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="">All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {filters.some((f) => f.value) ? (
        <a href="?" className="text-xs font-medium text-slate-400 underline hover:text-slate-700">
          Clear filters
        </a>
      ) : null}
    </form>
  );
}
