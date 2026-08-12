// §8 Import Strategy: Landing -> Staging -> Conforming -> Load, four stages.
// A CSV upload is the "landing" (the web equivalent of "drop the file, click
// Refresh"); this module does staging (parse), conforming (match to master
// data by natural key -- never by name) and load (append to
// fact_ActualAllocation, tagged with an ImportBatch). Rows that fail to
// conform are never dropped -- they land in ImportException for review.
import "server-only";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { buildCalendarDateRow, mondayOf } from "@/lib/calendar";

type CsvRow = Record<string, string>;

export type ImportResult = {
  batchId: number;
  rowCount: number;
  loadedCount: number;
  exceptionCount: number;
};

const REQUIRED_COLUMNS = ["EmployeeNumber", "WeekCommencing", "Hours"];

export const TIMESHEET_CSV_TEMPLATE =
  "EmployeeNumber,ProjectCode,ForecastSource,WeekCommencing,Hours\n" +
  "EMP-1002,PRJ-450,Project,2026-08-03,30\n" +
  "EMP-1004,,Annual Leave,2026-08-03,7.5\n";

type PendingException = { importBatchId: number; rowNumber: number; rawData: string; reason: string };

export async function importTimesheetCsv(fileName: string, csvText: string): Promise<ImportResult> {
  let rows: CsvRow[];
  try {
    rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];
  } catch (e) {
    throw new Error(`Could not parse CSV: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  if (rows.length === 0) throw new Error("The file has no data rows.");

  const headerSet = new Set(Object.keys(rows[0]));
  const missing = REQUIRED_COLUMNS.filter((c) => !headerSet.has(c));
  if (missing.length > 0) throw new Error(`Missing required column(s): ${missing.join(", ")}`);

  const [employees, projects, sources] = await Promise.all([
    db.employee.findMany({ select: { id: true, employeeNumber: true } }),
    db.project.findMany({ select: { id: true, projectCode: true } }),
    db.forecastSource.findMany({ select: { id: true, name: true } }),
  ]);
  const employeeByNumber = new Map(employees.filter((e) => e.employeeNumber).map((e) => [e.employeeNumber as string, e.id]));
  const projectByCode = new Map(projects.filter((p) => p.projectCode).map((p) => [p.projectCode as string, p.id]));
  const sourceByName = new Map(sources.map((s) => [s.name.toLowerCase(), s.id]));
  const defaultSource = sources.find((s) => s.name === "Project") ?? sources[0];

  const batch = await db.importBatch.create({
    data: { sourceSystem: "CSV Upload", sourceFileName: fileName, rowCount: rows.length, exceptionCount: 0 },
  });

  let loadedCount = 0;
  const exceptions: PendingException[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // header occupies row 1
    const raw = JSON.stringify(row);
    const fail = (reason: string) => exceptions.push({ importBatchId: batch.id, rowNumber, rawData: raw, reason });

    const employeeNumber = row.EmployeeNumber?.trim();
    const employeeId = employeeNumber ? employeeByNumber.get(employeeNumber) : undefined;
    if (!employeeId) {
      fail(`Unknown EmployeeNumber "${employeeNumber ?? ""}"`);
      continue;
    }

    const hoursRaw = row.Hours?.trim();
    const hours = hoursRaw ? Number(hoursRaw) : NaN;
    if (!hoursRaw || Number.isNaN(hours) || hours <= 0) {
      fail(`Invalid Hours value "${hoursRaw ?? ""}"`);
      continue;
    }

    const weekRaw = row.WeekCommencing?.trim();
    const parsedDate = weekRaw ? new Date(weekRaw) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      fail(`Invalid WeekCommencing date "${weekRaw ?? ""}"`);
      continue;
    }

    const projectCode = row.ProjectCode?.trim();
    let projectId: number | null = null;
    if (projectCode) {
      const found = projectByCode.get(projectCode);
      if (!found) {
        fail(`Unknown ProjectCode "${projectCode}"`);
        continue;
      }
      projectId = found;
    }

    const sourceNameRaw = row.ForecastSource?.trim();
    let forecastSourceId: number | undefined;
    if (sourceNameRaw) {
      forecastSourceId = sourceByName.get(sourceNameRaw.toLowerCase());
      if (!forecastSourceId) {
        fail(`Unknown ForecastSource "${sourceNameRaw}"`);
        continue;
      }
    } else {
      forecastSourceId = defaultSource?.id;
    }
    if (!forecastSourceId) {
      fail("No forecast source resolved (none configured in this system)");
      continue;
    }

    const calendarRow = buildCalendarDateRow(mondayOf(parsedDate));
    await db.calendarDate.upsert({ where: { dateKey: calendarRow.dateKey }, update: {}, create: calendarRow });

    await db.actualAllocation.create({
      data: {
        employeeId,
        projectId,
        forecastSourceId,
        dateKey: calendarRow.dateKey,
        actualHours: hours.toString(),
        importBatchId: batch.id,
      },
    });
    loadedCount++;
  }

  if (exceptions.length > 0) {
    await db.importException.createMany({ data: exceptions });
  }
  await db.importBatch.update({ where: { id: batch.id }, data: { exceptionCount: exceptions.length } });

  return { batchId: batch.id, rowCount: rows.length, loadedCount, exceptionCount: exceptions.length };
}
