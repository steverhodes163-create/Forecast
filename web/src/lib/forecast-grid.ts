// Data layer for the calendarised forecast grid (§7): teams -> members down
// the rows, months -> weeks across the columns. Team and month values are
// always computed rollups, never stored -- the only thing ever written is a
// single employee/project/week cell via setForecastCellAction.
import { db } from "@/lib/db";
import { buildCalendarDateRow, mondayOf } from "@/lib/calendar";
import { monthLabel } from "@/lib/measures";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GridWeekColumn = { dateKey: number; weekNumber: number; label: string };
export type GridMonthColumn = { monthKey: string; label: string; weeks: GridWeekColumn[] };

/**
 * Builds the month/week column structure for a rolling window starting at
 * `startMonth`, and ensures a CalendarDate row exists for every Monday in
 * that window (the grid must work on a project with no prior activity, so
 * it can't rely on dates being pre-seeded -- same idea as the Capacity
 * form's single-row ensure-exists upsert, generalised to a range).
 */
export async function ensureCalendarWeeksInRange(startMonth: Date, monthCount: number): Promise<GridMonthColumn[]> {
  const months: GridMonthColumn[] = [];
  const rows: ReturnType<typeof buildCalendarDateRow>[] = [];

  for (let m = 0; m < monthCount; m++) {
    const monthDate = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + m, 1));
    const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
    const monthKey = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;

    let cursor = mondayOf(monthDate);
    if (cursor < monthDate) cursor = new Date(cursor.getTime() + 7 * DAY_MS);

    const weeks: GridWeekColumn[] = [];
    while (cursor <= monthEnd) {
      const row = buildCalendarDateRow(cursor);
      rows.push(row);
      weeks.push({ dateKey: row.dateKey, weekNumber: row.weekNumber, label: `Wk ${row.weekNumber}` });
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
    }

    months.push({ monthKey, label: monthLabel(monthKey), weeks });
  }

  await Promise.all(rows.map((row) => db.calendarDate.upsert({ where: { dateKey: row.dateKey }, update: {}, create: row })));

  return months;
}

export type GridTask = {
  taskId: number;
  name: string;
  isCritical: boolean;
  hoursByDateKey: Record<number, number>;
};

export type GridEmployee = {
  employeeId: number;
  name: string;
  standardWeeklyHours: number;
  hoursByDateKey: Record<number, number>; // direct-entry rows only (taskId IS NULL)
  tasks: GridTask[];
};

export type GridTeam = {
  teamId: number;
  teamName: string;
  employees: GridEmployee[];
};

export type ProjectForecastGrid = {
  months: GridMonthColumn[];
  teams: GridTeam[];
};

// The grid always writes employee-mode rows tagged as project-linked work,
// so it never collides with (and never overwrites) a manually-entered row
// for the same employee/week logged against a different ForecastSource
// (e.g. "Annual Leave", "BAU") -- see the `gridCell` unique constraint on
// ForecastAllocation, which is scoped by resourceTypeId + forecastSourceId.
// Shared by direct-entry cell writes (actions/forecast-grid.ts) and
// task-generated writes (task-service.ts) so both paths use the same tag.
let cachedGridDefaults: { resourceTypeId: number; forecastSourceId: number } | null = null;
export async function gridDefaults() {
  if (cachedGridDefaults) return cachedGridDefaults;
  const [resourceType, forecastSource] = await Promise.all([
    db.resourceType.findFirstOrThrow({ where: { name: "Employee" } }),
    db.forecastSource.findFirstOrThrow({ where: { name: "Project" } }),
  ]);
  cachedGridDefaults = { resourceTypeId: resourceType.id, forecastSourceId: forecastSource.id };
  return cachedGridDefaults;
}

export async function getProjectForecastGrid(
  projectId: number,
  scenarioId: number,
  months: GridMonthColumn[]
): Promise<ProjectForecastGrid> {
  const dateKeys = months.flatMap((m) => m.weeks.map((w) => w.dateKey));

  const [projectTeams, allocations] = await Promise.all([
    db.projectTeam.findMany({
      where: { projectId },
      include: {
        team: {
          include: {
            employees: {
              orderBy: { name: "asc" },
              select: { id: true, name: true, standardWeeklyHours: true },
            },
          },
        },
      },
      orderBy: { team: { name: "asc" } },
    }),
    db.forecastAllocation.findMany({
      where: { projectId, scenarioId, employeeId: { not: null }, dateKey: { in: dateKeys } },
      select: { employeeId: true, dateKey: true, hours: true, taskId: true, task: { select: { name: true, isCritical: true } } },
    }),
  ]);

  const directHoursByEmployee = new Map<number, Record<number, number>>();
  const tasksByEmployee = new Map<number, Map<number, GridTask>>();
  for (const a of allocations) {
    if (a.employeeId === null) continue;
    if (a.taskId === null || !a.task) {
      const bucket = directHoursByEmployee.get(a.employeeId) ?? {};
      bucket[a.dateKey] = Number(a.hours);
      directHoursByEmployee.set(a.employeeId, bucket);
      continue;
    }
    const employeeTasks = tasksByEmployee.get(a.employeeId) ?? new Map<number, GridTask>();
    const task = employeeTasks.get(a.taskId) ?? {
      taskId: a.taskId,
      name: a.task.name,
      isCritical: a.task.isCritical,
      hoursByDateKey: {},
    };
    task.hoursByDateKey[a.dateKey] = Number(a.hours);
    employeeTasks.set(a.taskId, task);
    tasksByEmployee.set(a.employeeId, employeeTasks);
  }

  const teams: GridTeam[] = projectTeams.map((pt) => ({
    teamId: pt.team.id,
    teamName: pt.team.name,
    employees: pt.team.employees.map((e) => ({
      employeeId: e.id,
      name: e.name,
      standardWeeklyHours: Number(e.standardWeeklyHours),
      hoursByDateKey: directHoursByEmployee.get(e.id) ?? {},
      tasks: Array.from((tasksByEmployee.get(e.id) ?? new Map()).values()),
    })),
  }));

  return { months, teams };
}
