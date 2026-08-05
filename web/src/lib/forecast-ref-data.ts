import { db } from "@/lib/db";

export async function getForecastFormRefData() {
  const [scenarios, projects, teams, employees, skills, resourceTypes, forecastSources, weeks] = await Promise.all([
    db.scenario.findMany({ where: { isLocked: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.skill.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.resourceType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.forecastSource.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // fact_ForecastAllocation's grain is weekly (§5.2) — filtered to Mondays below.
    db.calendarDate.findMany({
      orderBy: { date: "asc" },
      select: { dateKey: true, date: true, weekNumber: true },
    }),
  ]);
  const mondaysOnly = weeks.filter((w) => new Date(w.date).getUTCDay() === 1);
  return { scenarios, projects, teams, employees, skills, resourceTypes, forecastSources, weeks: mondaysOnly };
}
