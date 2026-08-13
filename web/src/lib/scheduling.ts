// Critical Path Method (CPM) scheduling for the Gantt/task-driven forecast
// (§7). Pure functions, no DB access -- called by task-service.ts with data
// already loaded, and reusable read-only by the Gantt page for a fresh
// live-graph render.
//
// Convention: every task's schedule is expressed as working-day offsets
// from an anchor date (Project.startDate, or today). Offset 0 is the
// anchor's own date (snapped forward to a working day if it falls on a
// weekend). earlyFinish/lateFinish are *exclusive* offsets -- a task
// spanning working-day offsets [ES, EF) occupies exactly `durationDays`
// working days, and a dependent task's earliest start is simply the
// predecessor's earlyFinish (+ lag), with no off-by-one adjustment needed.

export type TaskNode = {
  id: number;
  durationDays: number;
  manualStartDate: Date | null;
  completedAt: Date | null; // when set, this is the task's ACTUAL finish -- fixes earlyFinish for propagation to successors, planned or not
};

export type DependencyEdge = {
  predecessorTaskId: number;
  successorTaskId: number;
  lagDays: number;
};

export type TaskSchedule = {
  taskId: number;
  startDate: Date;
  endDate: Date; // last working day, inclusive
  isCritical: boolean;
  slack: number;
  manualDateConflict: boolean; // manualStartDate requested earlier than dependencies allow
};

export function isWorkingDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

function snapToWorkingDay(d: Date): Date {
  const result = new Date(d);
  while (!isWorkingDay(result)) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  return result;
}

/** The date that is `days` working days after `start` (day 0 = start itself, snapped forward onto a working day). */
export function addWorkingDays(start: Date, days: number): Date {
  const result = snapToWorkingDay(new Date(start));
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isWorkingDay(result)) remaining--;
  }
  return result;
}

/** Working-day offset of `date` relative to `anchor` (inverse of addWorkingDays; can be negative). */
export function workingDaysBetween(anchor: Date, date: Date): number {
  const a = snapToWorkingDay(new Date(anchor));
  const target = new Date(date);
  let count = 0;
  const cursor = new Date(a);
  if (target < a) {
    while (cursor > target) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      if (isWorkingDay(cursor)) count--;
    }
    return count;
  }
  while (cursor < target) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor)) count++;
  }
  return count;
}

export function computeSchedule(
  tasks: TaskNode[],
  dependencies: DependencyEdge[],
  anchorDate: Date
): Map<number, TaskSchedule> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predecessorsOf = new Map<number, DependencyEdge[]>();
  const successorsOf = new Map<number, DependencyEdge[]>();
  for (const dep of dependencies) {
    if (!byId.has(dep.predecessorTaskId) || !byId.has(dep.successorTaskId)) continue;
    if (!predecessorsOf.has(dep.successorTaskId)) predecessorsOf.set(dep.successorTaskId, []);
    predecessorsOf.get(dep.successorTaskId)!.push(dep);
    if (!successorsOf.has(dep.predecessorTaskId)) successorsOf.set(dep.predecessorTaskId, []);
    successorsOf.get(dep.predecessorTaskId)!.push(dep);
  }

  // Topological order via DFS. Cycles are rejected at write time
  // (addTaskDependencyAction), so `visiting` here is only a defensive
  // guard against an infinite loop, never expected to trigger.
  const order: number[] = [];
  const visited = new Set<number>();
  const visiting = new Set<number>();
  function visit(id: number) {
    if (visited.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const dep of predecessorsOf.get(id) ?? []) visit(dep.predecessorTaskId);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }
  for (const t of tasks) visit(t.id);

  const earlyStart = new Map<number, number>();
  const earlyFinish = new Map<number, number>();
  const manualConflict = new Map<number, boolean>();

  for (const id of order) {
    const task = byId.get(id)!;
    let es = 0;
    for (const dep of predecessorsOf.get(id) ?? []) {
      es = Math.max(es, (earlyFinish.get(dep.predecessorTaskId) ?? 0) + dep.lagDays);
    }
    let conflict = false;
    if (task.manualStartDate) {
      const manualOffset = workingDaysBetween(anchorDate, task.manualStartDate);
      if (manualOffset > es) es = manualOffset;
      else if (manualOffset < es) conflict = true;
    }
    earlyStart.set(id, es);
    // A completed task's finish is a fact, not an estimate -- successors
    // reschedule from when the work actually finished (early or late),
    // overriding the planned es + durationDays.
    const ef = task.completedAt ? workingDaysBetween(anchorDate, task.completedAt) + 1 : es + task.durationDays;
    earlyFinish.set(id, ef);
    manualConflict.set(id, conflict);
  }

  const projectFinish = tasks.length ? Math.max(...tasks.map((t) => earlyFinish.get(t.id) ?? 0)) : 0;

  const lateFinish = new Map<number, number>();
  const lateStart = new Map<number, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const task = byId.get(id)!;
    const succs = successorsOf.get(id) ?? [];
    const lf = succs.length
      ? Math.min(...succs.map((dep) => (lateStart.get(dep.successorTaskId) ?? projectFinish) - dep.lagDays))
      : projectFinish;
    lateFinish.set(id, lf);
    lateStart.set(id, lf - task.durationDays);
  }

  const result = new Map<number, TaskSchedule>();
  for (const t of tasks) {
    const es = earlyStart.get(t.id) ?? 0;
    const ef = earlyFinish.get(t.id) ?? es + t.durationDays;
    const ls = lateStart.get(t.id) ?? es;
    const slack = ls - es;
    result.set(t.id, {
      taskId: t.id,
      startDate: addWorkingDays(anchorDate, es),
      endDate: addWorkingDays(anchorDate, Math.max(es, ef - 1)),
      isCritical: slack === 0,
      slack,
      manualDateConflict: manualConflict.get(t.id) ?? false,
    });
  }
  return result;
}

/** Prorated hours a task contributes to one Monday-keyed week, given its computed date range. */
export function weeklyHoursForTask(taskStart: Date, taskEnd: Date, weekMonday: Date, weeklyHours: number): number {
  const weekFriday = new Date(weekMonday);
  weekFriday.setUTCDate(weekFriday.getUTCDate() + 4);
  const overlapStart = taskStart > weekMonday ? taskStart : weekMonday;
  const overlapEnd = taskEnd < weekFriday ? taskEnd : weekFriday;
  if (overlapStart > overlapEnd) return 0;

  let workingDaysInOverlap = 0;
  const cursor = new Date(overlapStart);
  while (cursor <= overlapEnd) {
    if (isWorkingDay(cursor)) workingDaysInOverlap++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return (workingDaysInOverlap / 5) * weeklyHours;
}
