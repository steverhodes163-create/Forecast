// Recomputes a project's task schedule (CPM) and regenerates the
// task-tagged ForecastAllocation rows that feed the forecast grid's task
// row level. Called by every task/dependency/assignment-mutating action in
// src/app/actions/tasks.ts, and exposed directly as a "recalculate for this
// scenario" action for when the user switches the active scenario without
// changing anything about the tasks themselves.
import { db } from "@/lib/db";
import { buildCalendarDateRow, mondayOf } from "@/lib/calendar";
import { gridDefaults } from "@/lib/forecast-grid";
import { getActiveScenarioId } from "@/lib/scenario";
import { computeSchedule, weeklyHoursForTask, type DependencyEdge, type TaskNode } from "@/lib/scheduling";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function mondaysBetween(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  let cursor = mondayOf(start);
  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + WEEK_MS);
  }
  return result;
}

async function ensureWeeksExist(mondays: Date[]): Promise<number[]> {
  const rows = mondays.map((d) => buildCalendarDateRow(d));
  await Promise.all(rows.map((row) => db.calendarDate.upsert({ where: { dateKey: row.dateKey }, update: {}, create: row })));
  return rows.map((r) => r.dateKey);
}

export async function recomputeProjectSchedule(projectId: number): Promise<void> {
  const [project, tasks, assignments, dependencies] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, select: { startDate: true } }),
    db.task.findMany({ where: { projectId }, select: { id: true, durationDays: true, manualStartDate: true } }),
    db.taskAssignment.findMany({
      where: { task: { projectId } },
      select: { taskId: true, employeeId: true, fte: true, employee: { select: { standardWeeklyHours: true, teamId: true } } },
    }),
    db.taskDependency.findMany({
      where: { predecessorTask: { projectId } },
      select: { predecessorTaskId: true, successorTaskId: true, lagDays: true },
    }),
  ]);

  const anchor = project.startDate ?? new Date();
  const taskNodes: TaskNode[] = tasks.map((t) => ({ id: t.id, durationDays: t.durationDays, manualStartDate: t.manualStartDate }));
  const depEdges: DependencyEdge[] = dependencies;
  const schedule = computeSchedule(taskNodes, depEdges, anchor);

  await Promise.all(
    tasks.map((t) => {
      const s = schedule.get(t.id);
      if (!s) return Promise.resolve();
      return db.task.update({
        where: { id: t.id },
        data: { computedStartDate: s.startDate, computedEndDate: s.endDate, isCritical: s.isCritical },
      });
    })
  );

  // A task's assignee might belong to a team that was never added to this
  // project's forecast grid -- without this, their task-driven hours would
  // exist in ForecastAllocation but never render anywhere. Tasks are meant
  // to drive the grid, so make sure the grid can always show what's driving it.
  const assignedTeamIds = Array.from(new Set(assignments.map((a) => a.employee.teamId).filter((id): id is number => id !== null)));
  if (assignedTeamIds.length > 0) {
    await Promise.all(
      assignedTeamIds.map((teamId) =>
        db.projectTeam.upsert({ where: { projectId_teamId: { projectId, teamId } }, update: {}, create: { projectId, teamId } })
      )
    );
  }

  const scenarioId = await getActiveScenarioId();
  const { resourceTypeId, forecastSourceId } = await gridDefaults();

  const assignmentsByTask = new Map<number, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByTask.get(a.taskId) ?? [];
    list.push(a);
    assignmentsByTask.set(a.taskId, list);
  }

  for (const t of tasks) {
    // Always clear stale task-generated rows -- covers assignments/dates
    // that changed, and the "no active scenario" degenerate case below.
    await db.forecastAllocation.deleteMany({ where: { taskId: t.id } });
    if (!scenarioId) continue;

    const s = schedule.get(t.id);
    const taskAssignments = assignmentsByTask.get(t.id) ?? [];
    if (!s || taskAssignments.length === 0) continue;

    const weeks = mondaysBetween(s.startDate, s.endDate);
    const dateKeys = await ensureWeeksExist(weeks);

    const rows = [];
    for (const assignment of taskAssignments) {
      const weeklyStandard = Number(assignment.employee.standardWeeklyHours);
      for (let i = 0; i < weeks.length; i++) {
        const hours = weeklyHoursForTask(s.startDate, s.endDate, weeks[i], weeklyStandard) * Number(assignment.fte);
        if (hours <= 0) continue;
        rows.push({
          scenarioId,
          employeeId: assignment.employeeId,
          projectId,
          dateKey: dateKeys[i],
          resourceTypeId,
          forecastSourceId,
          taskId: t.id,
          hours: hours.toFixed(2),
        });
      }
    }
    if (rows.length > 0) {
      await db.forecastAllocation.createMany({ data: rows });
    }
  }
}
