"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "./theme";
import type { MonthlyDemandCapacity } from "@/lib/measures";

// The §9 "Manhattan Chart" — demand vs capacity by month, side by side.
export function ManhattanChart({ data }: { data: MonthlyDemandCapacity[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value) => [`${Number(value).toLocaleString()} hrs`, undefined]}
          contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: chartColors.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="availableHours" name="Available capacity" fill={chartColors.capacity} radius={[3, 3, 0, 0]} />
        <Bar dataKey="demandHours" name="Booked demand" fill={chartColors.demand} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
