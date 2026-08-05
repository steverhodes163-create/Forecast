import { db } from "@/lib/db";

export async function getProjectFormRefData() {
  const [customers, programmes, businessUnits, priorities, statuses, employees, costCentres] = await Promise.all([
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.programme.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.businessUnit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.priority.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.projectStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.costCentre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { customers, programmes, businessUnits, priorities, statuses, employees, costCentres };
}
