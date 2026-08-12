// One palette for every chart, so the dashboards read as one system rather
// than each page picking its own colours.
export const chartColors = {
  demand: "#1e293b", // slate-800 — hours booked/consumed
  capacity: "#0ea5e9", // sky-500 — hours available
  weighted: "#0ea5e9",
  committed: "#1e293b",
  stretch: "#cbd5e1", // slate-300
  grid: "#e2e8f0", // slate-200
  axis: "#94a3b8", // slate-400
  good: "#16a34a", // green-600
  warn: "#d97706", // amber-600
  risk: "#dc2626", // red-600
};

export function utilisationColor(pct: number | null): string {
  if (pct === null) return "#f1f5f9"; // slate-100 — no data
  if (pct > 100) return "#fecaca"; // red-200
  if (pct >= 90) return "#fde68a"; // amber-200
  if (pct >= 60) return "#bbf7d0"; // green-200
  return "#e2e8f0"; // slate-200 — under-utilised
}

export function utilisationTextColor(pct: number | null): string {
  if (pct === null) return "#94a3b8";
  if (pct > 100) return "#991b1b";
  if (pct >= 90) return "#92400e";
  if (pct >= 60) return "#166534";
  return "#475569";
}
