// Pure helpers backing the Gantt chart's drag-to-resize/drag-to-move
// interaction (src/components/gantt-chart.tsx). No DOM/React dependency --
// same style as scheduling.ts/task-shorthand.ts.

/** Pixel delta -> calendar-day delta, using the chart's own PX_PER_DAY convention (raw calendar days, not working days -- matches how bars are positioned). */
export function pixelDeltaToCalendarDays(deltaX: number, pxPerDay: number): number {
  return Math.round(deltaX / pxPerDay);
}

/** Floors a resize preview at 1 day, mirroring setTaskDurationAction's own server-side rejection of durations under 1 day. */
export function clampResizeDays(originalDurationDays: number, deltaDays: number): number {
  return Math.max(1, originalDurationDays + deltaDays);
}
