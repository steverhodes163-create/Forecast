"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "./theme";
import type { DemandBridge } from "@/lib/measures";

type Row = { name: string; base: number; value: number; total: number };

// §7.1 demand bridge, rendered as a classic waterfall: each bar's visible
// segment is the increment over the previous total, stacked on an invisible
// spacer bar so the bars appear to "step up." If a later total is actually
// lower (weighted demand can come in under committed hours in edge cases),
// the increment floors at zero rather than drawing a negative bar — the
// tooltip still shows the true total either way.
function buildRows(bridge: DemandBridge): Row[] {
  const { committedHours, weightedHours, stretchHours } = bridge;
  return [
    { name: "Committed", base: 0, value: committedHours, total: committedHours },
    { name: "Weighted", base: committedHours, value: Math.max(0, weightedHours - committedHours), total: weightedHours },
    { name: "Stretch", base: weightedHours, value: Math.max(0, stretchHours - weightedHours), total: stretchHours },
  ];
}

function BridgeTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-800">{row.name}</p>
      <p className="text-slate-500">{row.total.toLocaleString()} hrs</p>
    </div>
  );
}

export function DemandWaterfall({ bridge }: { bridge: DemandBridge }) {
  const data = buildRows(bridge);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={{ stroke: chartColors.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: chartColors.axis }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<BridgeTooltip />} />
        <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="bridge" fill={chartColors.capacity} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
