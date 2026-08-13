"use client";

import type { GanttTask } from "@/lib/gantt";

// Phase A: a correct, fully computed Gantt (bars, dependency arrows,
// critical path in red, today marker) that's read-only here -- edited via
// TaskForm, not by dragging. Drag-to-resize is an explicit follow-up pass.
const PX_PER_DAY = 26;
const ROW_HEIGHT = 34;
const LABEL_WIDTH = 220;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function GanttChart({ tasks }: { tasks: GanttTask[] }) {
  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No tasks yet — add one below.</p>;
  }

  const sorted = [...tasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const rangeStart = new Date(Math.min(...sorted.map((t) => new Date(t.startDate).getTime())));
  const rangeEndRaw = new Date(Math.max(...sorted.map((t) => new Date(t.endDate).getTime())));
  const rangeEnd = new Date(rangeEndRaw.getTime() + 3 * DAY_MS);

  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const chartWidth = totalDays * PX_PER_DAY;
  const chartHeight = sorted.length * ROW_HEIGHT;

  const rowIndexByTaskId = new Map(sorted.map((t, i) => [t.id, i]));
  const barRect = (t: GanttTask) => {
    const left = daysBetween(rangeStart, new Date(t.startDate)) * PX_PER_DAY;
    const width = Math.max(PX_PER_DAY, (daysBetween(new Date(t.startDate), new Date(t.endDate)) + 1) * PX_PER_DAY);
    const top = (rowIndexByTaskId.get(t.id) ?? 0) * ROW_HEIGHT;
    return { left, width, top };
  };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayLeft = daysBetween(rangeStart, today) * PX_PER_DAY;

  const connectors: { path: string; critical: boolean }[] = [];
  for (const t of sorted) {
    const succRect = barRect(t);
    for (const predId of t.dependsOn) {
      const pred = sorted.find((p) => p.id === predId);
      if (!pred) continue;
      const predRect = barRect(pred);
      const startX = predRect.left + predRect.width;
      const startY = predRect.top + ROW_HEIGHT / 2;
      const endX = succRect.left;
      const endY = succRect.top + ROW_HEIGHT / 2;
      const midX = startX + Math.max(10, (endX - startX) / 2);
      connectors.push({ path: `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`, critical: t.isCritical && pred.isCritical });
    }
  }

  return (
    <div className="flex overflow-x-auto rounded-md border border-slate-200">
      <div className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-white" style={{ width: LABEL_WIDTH }}>
        <div className="h-8 border-b border-slate-200" />
        {sorted.map((t) => (
          <div key={t.id} className="flex items-center border-b border-slate-50 px-2 text-xs" style={{ height: ROW_HEIGHT }}>
            <span className={`truncate ${t.isCritical ? "font-medium text-red-600" : "text-slate-700"}`} title={t.name}>
              {t.name}
            </span>
          </div>
        ))}
      </div>
      <div className="relative" style={{ width: chartWidth, height: chartHeight + 32 }}>
        <div className="absolute left-0 top-0 h-8 w-full border-b border-slate-200" />
        <div className="absolute" style={{ top: 32, left: 0, width: chartWidth, height: chartHeight }}>
          <svg width={chartWidth} height={chartHeight} className="pointer-events-none absolute inset-0">
            <defs>
              <marker id="gantt-arrow-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
              </marker>
              <marker id="gantt-arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {connectors.map((c, i) => (
              <path
                key={i}
                d={c.path}
                fill="none"
                stroke={c.critical ? "#dc2626" : "#94a3b8"}
                strokeWidth={1.5}
                markerEnd={c.critical ? "url(#gantt-arrow-critical)" : "url(#gantt-arrow-normal)"}
              />
            ))}
          </svg>
          {todayLeft >= 0 && todayLeft <= chartWidth ? (
            <div className="absolute top-0 h-full border-l border-dashed border-amber-500" style={{ left: todayLeft }} title="Today" />
          ) : null}
          {sorted.map((t) => {
            const rect = barRect(t);
            return (
              <div
                key={t.id}
                className={`absolute flex items-center rounded px-2 text-[11px] font-medium text-white ${t.isCritical ? "bg-red-500" : "bg-blue-500"}`}
                style={{ left: rect.left, top: rect.top + 6, width: rect.width, height: ROW_HEIGHT - 12 }}
                title={`${t.name}: ${formatDate(t.startDate)} – ${formatDate(t.endDate)} (${t.durationDays}d)${
                  t.manualDateConflict ? " — manual start date conflicts with dependencies, dependencies win" : ""
                }`}
              >
                <span className="truncate">{t.durationDays}d</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
