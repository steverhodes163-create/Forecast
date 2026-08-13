"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "./theme";
import type { MonthlyAccuracy } from "@/lib/measures";

// §8 "Actual vs Forecast" / Forecast Accuracy chart.
export function ForecastAccuracyChart({ data }: { data: MonthlyAccuracy[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toLocaleString()} hrs`, name]}
          contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: chartColors.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="forecastHours" name="Forecast" fill={chartColors.capacity} radius={[3, 3, 0, 0]} />
        <Bar dataKey="actualHours" name="Actual" fill={chartColors.demand} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
