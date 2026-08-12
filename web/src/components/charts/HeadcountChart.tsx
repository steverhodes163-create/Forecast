"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "./theme";
import type { TeamHeadcount } from "@/lib/measures";

// §9 "headcount vs vacancy vs recruitment pipeline" bar chart.
export function HeadcountChart({ data }: { data: TeamHeadcount[] }) {
  const rows = data.map((d) => ({
    name: d.teamName,
    Budgeted: d.budgeted,
    Actual: d.actual,
    Vacancies: d.vacancies,
    "Open requisitions": d.openRequisitions,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: chartColors.grid }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Budgeted" fill={chartColors.capacity} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Actual" fill={chartColors.demand} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Vacancies" fill={chartColors.warn} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Open requisitions" fill={chartColors.risk} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
