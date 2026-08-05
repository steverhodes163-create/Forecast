// Shared dim_Calendar row-building logic (§5.1) — used by both the seed
// script and any runtime code (e.g. Capacity input) that needs to ensure a
// CalendarDate row exists for a given date, so this isn't duplicated per caller.
export function dateKeyFor(d: Date): number {
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`
  );
}

export function mondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function buildCalendarDateRow(d: Date) {
  const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  return {
    dateKey: dateKeyFor(d),
    date: d,
    dayName: d.toLocaleDateString("en-GB", { weekday: "long" }),
    weekNumber: Math.ceil(d.getUTCDate() / 7),
    weekStartDate: mondayOf(d),
    monthNumber: d.getUTCMonth() + 1,
    monthName: d.toLocaleDateString("en-GB", { month: "long" }),
    quarter: Math.floor(d.getUTCMonth() / 3) + 1,
    fiscalYear: d.getUTCFullYear(),
    fiscalPeriod: d.getUTCMonth() + 1,
    isWorkingDay: !isWeekend,
    isPublicHoliday: false,
  };
}
