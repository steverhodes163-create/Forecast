"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "./theme";
import type { TeamMonthUtilisation } from "@/lib/measures";

const LINE_COLORS = [chartColors.demand, chartColors.capacity, "#9333ea", "#059669", "#d97706", "#dc2626"];

// Pivots per-team month rows into one row per month with a column per team,
// which is the shape recharts' multi-series LineChart expects.
function pivot(rows: TeamMonthUtilisation[]) {
  if (rows.length === 0) return [];
  return rows[0].months.map((m, i) => {
    const point: Record<string, string | number | null> = { label: m.label };
    for (const row of rows) point[row.teamName] = row.months[i].utilisationPct;
    return point;
  });
}

export function UtilisationTrendChart({ rows }: { rows: TeamMonthUtilisation[] }) {
  const data = pivot(rows);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: chartColors.axis }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip formatter={(value) => [value === null ? "no data" : `${value}%`, undefined]} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: chartColors.grid }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {rows.map((row, i) => (
          <Line
            key={row.teamId}
            type="monotone"
            dataKey={row.teamName}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
