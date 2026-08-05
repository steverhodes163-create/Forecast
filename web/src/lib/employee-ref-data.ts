import { db } from "@/lib/db";

export async function getEmployeeFormRefData() {
  const [departments, teams, jobRoles, grades, employmentTypes, locations, workingCalendars, statuses, employees] =
    await Promise.all([
      db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.jobRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.grade.findMany({ orderBy: { level: "asc" }, select: { id: true, name: true } }),
      db.employmentType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.workingCalendar.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.employeeStatus.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
  return { departments, teams, jobRoles, grades, employmentTypes, locations, workingCalendars, statuses, employees };
}
