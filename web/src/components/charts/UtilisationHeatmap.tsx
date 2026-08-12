import { utilisationColor, utilisationTextColor } from "./theme";
import type { TeamMonthUtilisation } from "@/lib/measures";

// §9 Skill/Team Heat Map — no client JS needed, this is just coloured markup.
export function UtilisationHeatmap({ rows }: { rows: TeamMonthUtilisation[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400">No teams yet.</p>;
  const months = rows[0].months;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-32 px-2 py-1 text-left font-medium text-slate-400">Team</th>
            {months.map((m) => (
              <th key={m.monthKey} className="px-2 py-1 text-center font-medium text-slate-400">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td className="px-2 py-1 font-medium text-slate-700">{row.teamName}</td>
              {row.months.map((m) => (
                <td key={m.monthKey} className="p-0 text-center">
                  <div
                    className="rounded py-2 font-semibold tabular-nums"
                    style={{ backgroundColor: utilisationColor(m.utilisationPct), color: utilisationTextColor(m.utilisationPct) }}
                    title={`${row.teamName} — ${m.label}: ${m.utilisationPct === null ? "no capacity data" : `${m.utilisationPct}%`}`}
                  >
                    {m.utilisationPct === null ? "—" : `${m.utilisationPct}%`}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <LegendSwatch color={utilisationColor(30)} label="Under 60% (headroom)" />
        <LegendSwatch color={utilisationColor(75)} label="60–89%" />
        <LegendSwatch color={utilisationColor(95)} label="90–100%" />
        <LegendSwatch color={utilisationColor(110)} label="Over 100% (at risk)" />
        <LegendSwatch color={utilisationColor(null)} label="No capacity entered" />
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
