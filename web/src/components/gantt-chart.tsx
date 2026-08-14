"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GanttTask } from "@/lib/gantt";
import { setTaskDurationAction, setTaskManualStartDateAction } from "@/app/actions/tasks";
import { pixelDeltaToCalendarDays, clampResizeDays } from "@/lib/gantt-drag";

// Bars support two drag gestures: dragging the body moves the whole task
// (writes Task.manualStartDate -- a "no earlier than" floor the CPM engine
// already knows how to reconcile against dependencies, see scheduling.ts);
// dragging the right-edge handle resizes it (writes durationDays via the
// same action the task sheet's Duration cell already uses). Both commit
// once, on drop -- the live preview during drag is pure client state, no
// server round-trip until pointerup.
const PX_PER_DAY = 26;
const ROW_HEIGHT = 34;
const LABEL_WIDTH = 220;
const DAY_MS = 24 * 60 * 60 * 1000;

type DragState =
  | { kind: "resize"; taskId: number; startX: number; startWidth: number; previewDays: number }
  | { kind: "move"; taskId: number; startX: number; startLeft: number; previewDeltaDays: number };

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function GanttChart({ tasks, projectId }: { tasks: GanttTask[]; projectId: number }) {
  const router = useRouter();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragError, setDragError] = useState<Record<number, string>>({});

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

  // Only the dragged bar's own rect is drag-aware -- connectors and every
  // other bar read the plain server-computed rect above, refreshing only
  // after the drop (router.refresh()), not live during the gesture.
  function displayRect(t: GanttTask) {
    const base = barRect(t);
    if (!dragState || dragState.taskId !== t.id) return base;
    if (dragState.kind === "resize") {
      const clampedDelta = clampResizeDays(t.durationDays, dragState.previewDays) - t.durationDays;
      return { ...base, width: Math.max(PX_PER_DAY, base.width + clampedDelta * PX_PER_DAY) };
    }
    return { ...base, left: base.left + dragState.previewDeltaDays * PX_PER_DAY };
  }

  async function commitResize(t: GanttTask, previewDays: number) {
    const newDurationDays = clampResizeDays(t.durationDays, previewDays);
    setDragState(null);
    if (newDurationDays === t.durationDays) return;
    const result = await setTaskDurationAction({ taskId: t.id, projectId, raw: `${newDurationDays}d` });
    if ("error" in result) {
      setDragError((prev) => ({ ...prev, [t.id]: result.error }));
      return;
    }
    setDragError((prev) => {
      if (!(t.id in prev)) return prev;
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    router.refresh();
  }

  async function commitMove(t: GanttTask, previewDeltaDays: number) {
    setDragState(null);
    if (previewDeltaDays === 0) return;
    const newStart = new Date(new Date(t.startDate).getTime() + previewDeltaDays * DAY_MS);
    const result = await setTaskManualStartDateAction({ taskId: t.id, projectId, date: toDateInputValue(newStart) });
    if ("error" in result) {
      setDragError((prev) => ({ ...prev, [t.id]: result.error }));
      return;
    }
    setDragError((prev) => {
      if (!(t.id in prev)) return prev;
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    router.refresh();
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>, t: GanttTask) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = barRect(t);
    setDragState({ kind: "resize", taskId: t.id, startX: e.clientX, startWidth: rect.width, previewDays: 0 });
  }

  function startMove(e: React.PointerEvent<HTMLDivElement>, t: GanttTask) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = barRect(t);
    setDragState({ kind: "move", taskId: t.id, startX: e.clientX, startLeft: rect.left, previewDeltaDays: 0 });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const days = pixelDeltaToCalendarDays(e.clientX - dragState.startX, PX_PER_DAY);
    if (dragState.kind === "resize") {
      if (days !== dragState.previewDays) setDragState({ ...dragState, previewDays: days });
    } else {
      if (days !== dragState.previewDeltaDays) setDragState({ ...dragState, previewDeltaDays: days });
    }
  }

  function onPointerUp(_e: React.PointerEvent<HTMLDivElement>, t: GanttTask) {
    if (!dragState || dragState.taskId !== t.id) return;
    // Pointer capture releases implicitly on pointerup; no explicit release
    // needed (and e.currentTarget here may be the bar, not whichever
    // element -- bar body or resize handle -- actually captured it).
    if (dragState.kind === "resize") commitResize(t, dragState.previewDays);
    else commitMove(t, dragState.previewDeltaDays);
  }

  function onPointerCancel() {
    setDragState(null);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayLeft = daysBetween(rangeStart, today) * PX_PER_DAY;

  const connectors: { path: string; critical: boolean }[] = [];
  for (const t of sorted) {
    const succRect = barRect(t);
    for (const { taskId: predId } of t.dependsOn) {
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
            const rect = displayRect(t);
            const dragging = dragState?.taskId === t.id;
            return (
              <div
                key={t.id}
                onPointerDown={(e) => startMove(e, t)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, t)}
                onPointerCancel={onPointerCancel}
                className={`absolute flex cursor-move items-center rounded px-2 text-[11px] font-medium text-white select-none ${
                  t.isCritical ? "bg-red-500" : "bg-blue-500"
                } ${dragging ? "opacity-80 ring-2 ring-slate-900" : ""}`}
                style={{ left: rect.left, top: rect.top + 6, width: rect.width, height: ROW_HEIGHT - 12 }}
                title={`${t.name}: ${formatDate(t.startDate)} – ${formatDate(t.endDate)} (${t.durationDays}d)${
                  t.manualDateConflict ? " — manual start date conflicts with dependencies, dependencies win" : ""
                }${dragError[t.id] ? ` — ${dragError[t.id]}` : ""}`}
              >
                <span className="truncate">{t.durationDays}d</span>
                {/* Pointer capture retargets move/up/cancel but they still bubble to the bar's own handlers above -- only pointerdown needs stopPropagation, to stop the bar's move-handler from also firing. */}
                <div onPointerDown={(e) => startResize(e, t)} className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
