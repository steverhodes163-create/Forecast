import { computeSchedule, weeklyHoursForTask, addWorkingDays } from "../src/lib/scheduling.ts";

const anchor = new Date(Date.UTC(2026, 7, 3)); // Monday 2026-08-03

// A(5d) -> B(3d) -> C(2d), pure chain, no lag
const tasks = [
  { id: 1, durationDays: 5, manualStartDate: null },
  { id: 2, durationDays: 3, manualStartDate: null },
  { id: 3, durationDays: 2, manualStartDate: null },
];
const deps = [
  { predecessorTaskId: 1, successorTaskId: 2, lagDays: 0 },
  { predecessorTaskId: 2, successorTaskId: 3, lagDays: 0 },
];

const schedule = computeSchedule(tasks, deps, anchor);
for (const t of tasks) {
  const s = schedule.get(t.id);
  console.log(
    `Task ${t.id}: ${s.startDate.toISOString().slice(0, 10)} -> ${s.endDate.toISOString().slice(0, 10)}  critical=${s.isCritical} slack=${s.slack}`
  );
}

const finish = schedule.get(3).endDate;
const expectedFinish = addWorkingDays(anchor, 9); // 10 working days total (5+3+2), offset 9 = last day
console.log("Chain finish:", finish.toISOString().slice(0, 10), " expected:", expectedFinish.toISOString().slice(0, 10));
console.log("All critical (pure chain, no slack anywhere):", tasks.every((t) => schedule.get(t.id).isCritical));

// Parallel branch: D(4d) alongside A->B (8d), both feeding E(1d). D should have slack, chain should be critical.
const tasks2 = [
  { id: 1, durationDays: 5, manualStartDate: null },
  { id: 2, durationDays: 3, manualStartDate: null },
  { id: 4, durationDays: 4, manualStartDate: null },
  { id: 5, durationDays: 1, manualStartDate: null },
];
const deps2 = [
  { predecessorTaskId: 1, successorTaskId: 2, lagDays: 0 },
  { predecessorTaskId: 2, successorTaskId: 5, lagDays: 0 },
  { predecessorTaskId: 4, successorTaskId: 5, lagDays: 0 },
];
const schedule2 = computeSchedule(tasks2, deps2, anchor);
console.log("\nParallel branch test:");
for (const t of tasks2) {
  const s = schedule2.get(t.id);
  console.log(`Task ${t.id}: critical=${s.isCritical} slack=${s.slack}`);
}
console.log("D (task 4) should have slack=4 (8-4), not critical:", schedule2.get(4).slack === 4 && !schedule2.get(4).isCritical);
console.log("A->B->E chain should all be critical:", [1, 2, 5].every((id) => schedule2.get(id).isCritical));

// weeklyHoursForTask proration check: task spans Wed-Fri of a 5-day week (3 of 5 days)
const weekMon = new Date(Date.UTC(2026, 7, 3));
const wedStart = new Date(Date.UTC(2026, 7, 5));
const friEnd = new Date(Date.UTC(2026, 7, 7));
const hrs = weeklyHoursForTask(wedStart, friEnd, weekMon, 37.5);
console.log("\nProration check: 3/5 days of 37.5hr week =", hrs, " expected 22.5:", hrs === 22.5);
