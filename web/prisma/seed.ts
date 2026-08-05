// Illustrative sample data proving the full model end to end.
// Organisation/customer/project names are fictional placeholders for demo purposes.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function dateKey(d: Date): number {
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate()
    ).padStart(2, "0")}`
  );
}

function mondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function seedCalendar(startDate: Date, weeks: number) {
  const rows = [];
  const cursor = mondayOf(startDate);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(cursor);
    d.setUTCDate(cursor.getUTCDate() + i);
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
    rows.push({
      dateKey: dateKey(d),
      date: d,
      dayName: d.toLocaleDateString("en-GB", { weekday: "long" }),
      weekNumber: Math.ceil((i + 1) / 7),
      weekStartDate: mondayOf(d),
      monthNumber: d.getUTCMonth() + 1,
      monthName: d.toLocaleDateString("en-GB", { month: "long" }),
      quarter,
      fiscalYear: d.getUTCFullYear(),
      fiscalPeriod: d.getUTCMonth() + 1,
      isWorkingDay: !isWeekend,
      isPublicHoliday: false,
    });
    void monthStart;
  }
  await db.calendarDate.createMany({ data: rows, skipDuplicates: true });
}

async function main() {
  console.log("Seeding reference data...");

  const [workingCalendar] = await Promise.all([
    db.workingCalendar.upsert({
      where: { name: "UK Standard" },
      update: {},
      create: { name: "UK Standard", standardWeeklyHours: 37.5, countryCode: "GB" },
    }),
  ]);

  const location = await db.location.upsert({
    where: { name: "Yarnton, UK" },
    update: {},
    create: { name: "Yarnton, UK", country: "United Kingdom", regionCode: "OX", workingCalendarId: workingCalendar.id },
  });

  const [permEmploymentType] = await Promise.all([
    db.employmentType.upsert({ where: { name: "Permanent" }, update: {}, create: { name: "Permanent" } }),
  ]);
  await Promise.all(
    ["Contractor", "Fixed Term", "Agency", "Graduate", "Apprentice"].map((name) =>
      db.employmentType.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const activeStatus = await db.employeeStatus.upsert({
    where: { name: "Active" },
    update: {},
    create: { name: "Active" },
  });
  await Promise.all(
    ["On Leave", "Leaver", "Future Starter"].map((name) =>
      db.employeeStatus.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const grades = await Promise.all(
    [
      { name: "Graduate Engineer", level: 1 },
      { name: "Engineer", level: 2 },
      { name: "Senior Engineer", level: 3 },
      { name: "Principal Engineer", level: 4 },
      { name: "Engineering Manager", level: 5 },
    ].map((g) => db.grade.upsert({ where: { name: g.name }, update: {}, create: g }))
  );

  const jobRoles = await Promise.all(
    [
      { name: "Rotor Design Engineer", disciplineCategory: "Mechanical" },
      { name: "Stator Design Engineer", disciplineCategory: "Mechanical" },
      { name: "Power Electronics Engineer", disciplineCategory: "Electrical" },
      { name: "Controls Engineer", disciplineCategory: "Electrical" },
      { name: "Test Engineer", disciplineCategory: "Test & Validation" },
      { name: "Programme Manager", disciplineCategory: "Programme" },
      { name: "Project Manager", disciplineCategory: "Programme" },
    ].map((r) => db.jobRole.upsert({ where: { name: r.name }, update: {}, create: r }))
  );
  const roleByName = Object.fromEntries(jobRoles.map((r) => [r.name, r]));

  const businessUnit = await db.businessUnit.upsert({
    where: { name: "E-Drive Systems" },
    update: {},
    create: { name: "E-Drive Systems" },
  });

  const deptMech = await db.department.upsert({
    where: { businessUnitId_name: { businessUnitId: businessUnit.id, name: "Mechanical Engineering" } },
    update: {},
    create: { name: "Mechanical Engineering", businessUnitId: businessUnit.id },
  });
  const deptElec = await db.department.upsert({
    where: { businessUnitId_name: { businessUnitId: businessUnit.id, name: "Power Electronics" } },
    update: {},
    create: { name: "Power Electronics", businessUnitId: businessUnit.id },
  });
  const deptPMO = await db.department.upsert({
    where: { businessUnitId_name: { businessUnitId: businessUnit.id, name: "Programme Management" } },
    update: {},
    create: { name: "Programme Management", businessUnitId: businessUnit.id },
  });

  const teamRotorStator = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptMech.id, name: "Rotor & Stator Design" } },
    update: {},
    create: { name: "Rotor & Stator Design", departmentId: deptMech.id, budgetedHeadcount: 12 },
  });
  const teamControls = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptElec.id, name: "Controls & Embedded Software" } },
    update: {},
    create: { name: "Controls & Embedded Software", departmentId: deptElec.id, budgetedHeadcount: 8 },
  });
  const teamPMO = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptPMO.id, name: "Programme Office" } },
    update: {},
    create: { name: "Programme Office", departmentId: deptPMO.id, budgetedHeadcount: 4 },
  });

  const costCentre = await db.costCentre.upsert({
    where: { code: "CC-100" },
    update: {},
    create: { code: "CC-100", name: "E-Drive Engineering", departmentId: deptMech.id },
  });

  console.log("Seeding employees...");
  const manager = await db.employee.create({
    data: {
      name: "Alex Whitfield",
      departmentId: deptMech.id,
      teamId: teamRotorStator.id,
      jobRoleId: roleByName["Programme Manager"].id,
      gradeId: grades.find((g) => g.name === "Engineering Manager")!.id,
      employmentTypeId: permEmploymentType.id,
      locationId: location.id,
      workingCalendarId: workingCalendar.id,
      contractHoursPerWeek: 37.5,
      standardWeeklyHours: 37.5,
      fte: 1,
      costRate: 68,
      employmentStartDate: new Date("2019-03-01"),
      statusId: activeStatus.id,
      holidayAllowanceDays: 25,
      trainingAllowanceDays: 5,
      utilisationTargetPct: 85,
    },
  });

  await db.team.update({ where: { id: teamRotorStator.id }, data: { managerEmployeeId: manager.id } });

  const engineerSeeds = [
    { name: "Priya Chandran", team: teamRotorStator, role: "Rotor Design Engineer", grade: "Senior Engineer", rate: 55 },
    { name: "Tom Harding", team: teamRotorStator, role: "Stator Design Engineer", grade: "Engineer", rate: 42 },
    { name: "Mei Lin Foster", team: teamControls, role: "Power Electronics Engineer", grade: "Senior Engineer", rate: 58 },
    { name: "Callum Reyes", team: teamControls, role: "Controls Engineer", grade: "Engineer", rate: 44 },
    { name: "Sofia Marchetti", team: teamPMO, role: "Project Manager", grade: "Senior Engineer", rate: 52 },
  ];
  const engineers = [];
  for (const e of engineerSeeds) {
    engineers.push(
      await db.employee.create({
        data: {
          name: e.name,
          managerEmployeeId: manager.id,
          departmentId: e.team.departmentId,
          teamId: e.team.id,
          jobRoleId: roleByName[e.role].id,
          gradeId: grades.find((g) => g.name === e.grade)!.id,
          employmentTypeId: permEmploymentType.id,
          locationId: location.id,
          workingCalendarId: workingCalendar.id,
          contractHoursPerWeek: 37.5,
          standardWeeklyHours: 37.5,
          fte: 1,
          costRate: e.rate,
          employmentStartDate: new Date("2021-06-01"),
          statusId: activeStatus.id,
          holidayAllowanceDays: 25,
          trainingAllowanceDays: 5,
          utilisationTargetPct: 85,
        },
      })
    );
  }

  console.log("Seeding skills...");
  const skillCategory = await db.skillCategory.upsert({
    where: { name: "Mechanical" },
    update: {},
    create: { name: "Mechanical" },
  });
  const skillCategoryElec = await db.skillCategory.upsert({
    where: { name: "Power Electronics" },
    update: {},
    create: { name: "Power Electronics" },
  });
  const rotorSkill = await db.skill.upsert({
    where: { name: "Rotor Design" },
    update: {},
    create: { name: "Rotor Design", skillCategoryId: skillCategory.id, isCriticalSkill: true },
  });
  const feaSkill = await db.skill.upsert({
    where: { name: "FEA" },
    update: {},
    create: { name: "FEA", skillCategoryId: skillCategory.id, isCriticalSkill: false },
  });
  const controlsSkill = await db.skill.upsert({
    where: { name: "Controls" },
    update: {},
    create: { name: "Controls", skillCategoryId: skillCategoryElec.id, isCriticalSkill: true },
  });

  await db.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId: engineers[0].id, skillId: rotorSkill.id } },
    update: {},
    create: {
      employeeId: engineers[0].id,
      skillId: rotorSkill.id,
      competencyLevel: 5,
      yearsExperience: 8,
      approved: true,
      isPrimarySkill: true,
    },
  });
  await db.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId: engineers[0].id, skillId: feaSkill.id } },
    update: {},
    create: {
      employeeId: engineers[0].id,
      skillId: feaSkill.id,
      competencyLevel: 4,
      yearsExperience: 6,
      approved: true,
      isSecondarySkill: true,
    },
  });
  await db.employeeSkill.upsert({
    where: { employeeId_skillId: { employeeId: engineers[3].id, skillId: controlsSkill.id } },
    update: {},
    create: {
      employeeId: engineers[3].id,
      skillId: controlsSkill.id,
      competencyLevel: 4,
      yearsExperience: 5,
      approved: true,
      isPrimarySkill: true,
    },
  });

  console.log("Seeding customers, programmes, projects...");
  const customer = await db.customer.upsert({
    where: { name: "Northbridge Mobility (sample)" },
    update: {},
    create: { name: "Northbridge Mobility (sample)", accountManagerEmployeeId: manager.id },
  });
  const programme = await db.programme.upsert({
    where: { id: -1 },
    update: {},
    create: { name: "Gen3 Axial Flux Platform (sample)", customerId: customer.id, programmeManagerEmployeeId: manager.id },
  }).catch(async () => {
    const existing = await db.programme.findFirst({ where: { name: "Gen3 Axial Flux Platform (sample)" } });
    return existing!;
  });

  const [statusWon, statusCommitted, statusRFQ] = await Promise.all([
    db.projectStatus.upsert({ where: { name: "Won" }, update: {}, create: { name: "Won", defaultProbabilityPct: 100, sortOrder: 5 } }),
    db.projectStatus.upsert({ where: { name: "Committed" }, update: {}, create: { name: "Committed", defaultProbabilityPct: 90, sortOrder: 4 } }),
    db.projectStatus.upsert({ where: { name: "RFQ" }, update: {}, create: { name: "RFQ", defaultProbabilityPct: 50, sortOrder: 2 } }),
  ]);
  await Promise.all([
    db.projectStatus.upsert({ where: { name: "Prospect" }, update: {}, create: { name: "Prospect", defaultProbabilityPct: 25, sortOrder: 1 } }),
    db.projectStatus.upsert({ where: { name: "Preferred" }, update: {}, create: { name: "Preferred", defaultProbabilityPct: 70, sortOrder: 3 } }),
    db.projectStatus.upsert({ where: { name: "Cancelled" }, update: {}, create: { name: "Cancelled", defaultProbabilityPct: 0, sortOrder: 6 } }),
  ]);

  const [priorityHigh, priorityMedium] = await Promise.all([
    db.priority.upsert({ where: { name: "High" }, update: {}, create: { name: "High", sortOrder: 1 } }),
    db.priority.upsert({ where: { name: "Medium" }, update: {}, create: { name: "Medium", sortOrder: 2 } }),
  ]);
  await db.priority.upsert({ where: { name: "Critical" }, update: {}, create: { name: "Critical", sortOrder: 0 } });
  await db.priority.upsert({ where: { name: "Low" }, update: {}, create: { name: "Low", sortOrder: 3 } });

  const projectWon = await db.project.create({
    data: {
      name: "NM-450 Traction Motor (sample)",
      customerId: customer.id,
      programmeId: programme.id,
      projectManagerEmployeeId: engineers[4].id,
      businessUnitId: businessUnit.id,
      priorityId: priorityHigh.id,
      projectStatusId: statusWon.id,
      lifecyclePhase: "Detail Design",
      startDate: new Date("2026-01-05"),
      finishDate: new Date("2026-12-18"),
      revenueForecast: 4200000,
      budgetCost: 2600000,
      targetMarginPct: 38,
      strategicImportance: true,
      ragStatus: "Green",
      costCentreId: costCentre.id,
    },
  });
  const projectRFQ = await db.project.create({
    data: {
      name: "Aurora Light Commercial EV Motor (sample)",
      customerId: customer.id,
      businessUnitId: businessUnit.id,
      priorityId: priorityMedium.id,
      projectStatusId: statusRFQ.id,
      lifecyclePhase: "Concept",
      startDate: new Date("2026-09-01"),
      finishDate: new Date("2027-06-30"),
      revenueForecast: 1800000,
      budgetCost: 1100000,
      targetMarginPct: 33,
      ragStatus: "Amber",
      costCentreId: costCentre.id,
    },
  });
  void statusCommitted;

  console.log("Seeding scenarios, resource types, forecast sources...");
  const scenarioBaseline = await db.scenario.upsert({
    where: { name: "Baseline" },
    update: {},
    create: { name: "Baseline", isActive: true },
  });
  await db.scenario.upsert({
    where: { name: "Budget" },
    update: {},
    create: { name: "Budget", isActive: true, isLocked: true },
  });

  const resourceTypeEmployee = await db.resourceType.upsert({
    where: { name: "Employee" },
    update: {},
    create: { name: "Employee" },
  });
  await Promise.all(
    ["Contractor", "Agency", "Graduate"].map((name) =>
      db.resourceType.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const sourceProject = await db.forecastSource.upsert({
    where: { name: "Project" },
    update: {},
    create: { name: "Project", isProjectLinked: true },
  });
  const sourceBAU = await db.forecastSource.upsert({
    where: { name: "BAU" },
    update: {},
    create: { name: "BAU", isProjectLinked: false },
  });
  await Promise.all(
    [
      "Business Development",
      "RFQ",
      "Continuous Improvement",
      "Innovation",
      "Training",
      "Management",
      "Quality",
      "Customer Support",
      "Annual Leave",
      "Sickness",
      "Internal Projects",
    ].map((name) => db.forecastSource.upsert({ where: { name }, update: {}, create: { name, isProjectLinked: false } }))
  );

  await Promise.all(
    ["Delay", "Cancel", "Win", "Recruitment Freeze", "New Hire", "Contractor Loss", "Team Expansion", "Team Reduction"].map(
      (name) => db.adjustmentType.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const [recruitStatusApproved] = await Promise.all([
    db.recruitmentStatus.upsert({ where: { name: "Vacancy Approved" }, update: {}, create: { name: "Vacancy Approved", sortOrder: 1 } }),
  ]);
  await Promise.all(
    ["Recruiting", "Interviewing", "Offer Made", "Offer Accepted", "Cancelled", "Started"].map((name, i) =>
      db.recruitmentStatus.upsert({ where: { name }, update: {}, create: { name, sortOrder: i + 2 } })
    )
  );

  console.log("Seeding calendar (26 weeks from today)...");
  await seedCalendar(new Date(), 26);

  console.log("Seeding forecast allocations and capacity...");
  const firstMonday = mondayOf(new Date());
  for (let w = 0; w < 12; w++) {
    const weekDate = new Date(firstMonday);
    weekDate.setUTCDate(firstMonday.getUTCDate() + w * 7);
    const dk = dateKey(weekDate);
    const calRow = await db.calendarDate.findUnique({ where: { dateKey: dk } });
    if (!calRow) continue;

    await db.forecastAllocation.create({
      data: {
        scenarioId: scenarioBaseline.id,
        projectId: projectWon.id,
        employeeId: engineers[0].id,
        resourceTypeId: resourceTypeEmployee.id,
        forecastSourceId: sourceProject.id,
        dateKey: dk,
        hours: 30,
        fte: 0.8,
      },
    });
    await db.forecastAllocation.create({
      data: {
        scenarioId: scenarioBaseline.id,
        projectId: projectRFQ.id,
        teamId: teamControls.id,
        resourceTypeId: resourceTypeEmployee.id,
        forecastSourceId: sourceProject.id,
        dateKey: dk,
        hours: 75,
        fte: 2,
      },
    });
    await db.forecastAllocation.create({
      data: {
        scenarioId: scenarioBaseline.id,
        skillId: rotorSkill.id,
        resourceTypeId: resourceTypeEmployee.id,
        forecastSourceId: sourceBAU.id,
        dateKey: dk,
        hours: 7.5,
        fte: 0.2,
      },
    });

    await db.capacity.upsert({
      where: { teamId_scenarioId_dateKey: { teamId: teamRotorStator.id, scenarioId: scenarioBaseline.id, dateKey: dk } },
      update: {},
      create: {
        teamId: teamRotorStator.id,
        scenarioId: scenarioBaseline.id,
        dateKey: dk,
        budgetedHeadcount: 12,
        actualHeadcount: 9,
        vacancies: 3,
        contractorsCount: 1,
        agencyCount: 0,
        graduateIntakeCount: 0,
        futureHiresCount: 2,
        leaversCount: 0,
        standardHours: 337.5,
        trainingHours: 15,
        businessShutdownHours: 0,
        holidayHours: 22.5,
        internalMeetingHours: 15,
        bauAllowanceHours: 30,
        managementOverheadHours: 15,
      },
    });
  }

  console.log("Seeding recruitment and budget...");
  await db.recruitment.create({
    data: {
      teamId: teamRotorStator.id,
      jobRoleId: roleByName["Rotor Design Engineer"].id,
      recruitmentStatusId: recruitStatusApproved.id,
      approvedDate: new Date(),
      targetStartDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
    },
  });

  const firstOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthDk = dateKey(firstOfMonth);
  await db.calendarDate.upsert({
    where: { dateKey: monthDk },
    update: {},
    create: {
      dateKey: monthDk,
      date: firstOfMonth,
      dayName: firstOfMonth.toLocaleDateString("en-GB", { weekday: "long" }),
      weekNumber: 1,
      weekStartDate: mondayOf(firstOfMonth),
      monthNumber: firstOfMonth.getUTCMonth() + 1,
      monthName: firstOfMonth.toLocaleDateString("en-GB", { month: "long" }),
      quarter: Math.floor(firstOfMonth.getUTCMonth() / 3) + 1,
      fiscalYear: firstOfMonth.getUTCFullYear(),
      fiscalPeriod: firstOfMonth.getUTCMonth() + 1,
      isWorkingDay: true,
      isPublicHoliday: false,
    },
  });
  await db.budget.upsert({
    where: {
      costCentreId_scenarioId_dateKey_costCategory: {
        costCentreId: costCentre.id,
        scenarioId: scenarioBaseline.id,
        dateKey: monthDk,
        costCategory: "DIRECT_LABOUR",
      },
    },
    update: {},
    create: {
      costCentreId: costCentre.id,
      scenarioId: scenarioBaseline.id,
      dateKey: monthDk,
      budgetAmount: 185000,
      costCategory: "DIRECT_LABOUR",
    },
  });

  console.log("Seeding measure catalogue...");
  await db.measureCatalog.upsert({
    where: { name: "Utilisation %" },
    update: {},
    create: {
      name: "Utilisation %",
      measureGroup: "Capacity & Utilisation",
      description: "Booked hours divided by available hours for the selected scope and period.",
      expression: "SUM(ForecastAllocation.hours) / (Capacity.standardHours - overheads)",
      businessQuestionTags: ["Do we have enough engineers?", "Which teams are overloaded?"],
    },
  });
  await db.measureCatalog.upsert({
    where: { name: "Weighted Demand" },
    update: {},
    create: {
      name: "Weighted Demand",
      measureGroup: "Demand & Probability",
      description: "Forecast hours multiplied by each project's effective win probability.",
      expression: "SUM(hours * COALESCE(Project.probabilityOverridePct, ProjectStatus.defaultProbabilityPct))",
      businessQuestionTags: ["What happens if a new programme is won?", "How much engineering capacity is available?"],
    },
  });

  console.log("Seeding admin user...");
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  await db.user.upsert({
    where: { email: "admin@yasa.local" },
    update: {},
    create: {
      email: "admin@yasa.local",
      name: "System Administrator",
      passwordHash,
      appRole: "ADMIN",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
