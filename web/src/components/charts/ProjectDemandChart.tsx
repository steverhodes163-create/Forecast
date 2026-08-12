"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "./theme";
import type { ProjectDemand } from "@/lib/measures";

function ragBarColor(rag: string | null): string {
  switch (rag) {
    case "Green":
      return chartColors.good;
    case "Amber":
      return chartColors.warn;
    case "Red":
      return chartColors.risk;
    default:
      return chartColors.capacity;
  }
}

// §9 Project Staffing Chart, simplified to weighted demand per project (§7.1),
// bar colour taken from the project's RAG status rather than a separate legend.
export function ProjectDemandChart({ data }: { data: ProjectDemand[] }) {
  const rows = [...data].sort((a, b) => b.weightedHours - a.weightedHours);
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 44)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="projectName"
          tick={{ fontSize: 12, fill: chartColors.axis }}
          axisLine={false}
          tickLine={false}
          width={220}
        />
        <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} hrs`, "Weighted demand"]} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: chartColors.grid }} />
        <Bar dataKey="weightedHours" radius={[0, 3, 3, 0]}>
          {rows.map((r) => (
            <Cell key={r.projectId} fill={ragBarColor(r.ragStatus)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
