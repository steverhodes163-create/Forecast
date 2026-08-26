// Illustrative sample data proving the full model end to end.
// Organisation/customer/project names are fictional placeholders for demo purposes.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { dateKeyFor, mondayOf, buildCalendarDateRow } from "../src/lib/calendar";
import { computeSchedule, weeklyHoursForTask, type DependencyEdge, type TaskNode } from "../src/lib/scheduling";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedCalendar(startDate: Date, weeks: number) {
  const rows = [];
  const cursor = mondayOf(startDate);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(cursor);
    d.setUTCDate(cursor.getUTCDate() + i);
    rows.push(buildCalendarDateRow(d));
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
      employeeNumber: "EMP-1001",
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
    { number: "EMP-1002", name: "Priya Chandran", team: teamRotorStator, role: "Rotor Design Engineer", grade: "Senior Engineer", rate: 55 },
    { number: "EMP-1003", name: "Tom Harding", team: teamRotorStator, role: "Stator Design Engineer", grade: "Engineer", rate: 42 },
    { number: "EMP-1004", name: "Mei Lin Foster", team: teamControls, role: "Power Electronics Engineer", grade: "Senior Engineer", rate: 58 },
    { number: "EMP-1005", name: "Callum Reyes", team: teamControls, role: "Controls Engineer", grade: "Engineer", rate: 44 },
    { number: "EMP-1006", name: "Sofia Marchetti", team: teamPMO, role: "Project Manager", grade: "Senior Engineer", rate: 52 },
  ];
  const engineers = [];
  for (const e of engineerSeeds) {
    engineers.push(
      await db.employee.create({
        data: {
          employeeNumber: e.number,
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
      projectCode: "PRJ-450",
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
      projectCode: "PRJ-AURORA",
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
    const dk = dateKeyFor(weekDate);
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

  }

  // fact_Capacity's documented grain is monthly (§5.2), unlike the weekly
  // fact_ForecastAllocation loop above — one row per team per month, not per
  // week, otherwise monthly aggregates (Available Hours, Utilisation %) would
  // silently sum several weeks' worth of the same figures into an inflated total.
  console.log("Seeding monthly capacity...");
  const CAPACITY_MONTHS = 4;
  for (let m = 0; m < CAPACITY_MONTHS; m++) {
    const monthStart = new Date(Date.UTC(firstMonday.getUTCFullYear(), firstMonday.getUTCMonth() + m, 1));
    const calendarRow = buildCalendarDateRow(monthStart);
    await db.calendarDate.upsert({ where: { dateKey: calendarRow.dateKey }, update: {}, create: calendarRow });

    await db.capacity.upsert({
      where: { teamId_scenarioId_dateKey: { teamId: teamRotorStator.id, scenarioId: scenarioBaseline.id, dateKey: calendarRow.dateKey } },
      update: {},
      create: {
        teamId: teamRotorStator.id,
        scenarioId: scenarioBaseline.id,
        dateKey: calendarRow.dateKey,
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

    // Controls team also carries team-mode demand in this seed (see the
    // teamId: teamControls.id forecast row above) — give it capacity too so
    // the utilisation heat map has more than one team to actually show.
    await db.capacity.upsert({
      where: { teamId_scenarioId_dateKey: { teamId: teamControls.id, scenarioId: scenarioBaseline.id, dateKey: calendarRow.dateKey } },
      update: {},
      create: {
        teamId: teamControls.id,
        scenarioId: scenarioBaseline.id,
        dateKey: calendarRow.dateKey,
        budgetedHeadcount: 8,
        actualHeadcount: 7,
        vacancies: 1,
        contractorsCount: 0,
        agencyCount: 0,
        graduateIntakeCount: 1,
        futureHiresCount: 0,
        leaversCount: 0,
        standardHours: 262.5,
        trainingHours: 10,
        businessShutdownHours: 0,
        holidayHours: 15,
        internalMeetingHours: 10,
        bauAllowanceHours: 20,
        managementOverheadHours: 10,
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
  const monthDk = dateKeyFor(firstOfMonth);
  await db.calendarDate.upsert({
    where: { dateKey: monthDk },
    update: {},
    create: buildCalendarDateRow(firstOfMonth),
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
  const passwordHash = await bcrypt.hash("steve", 12);
  await db.user.upsert({
    where: { email: "steve@yasa.local" },
    update: {},
    create: {
      email: "steve@yasa.local",
      name: "System Administrator",
      passwordHash,
      appRole: "ADMIN",
    },
  });

  // ---------------------------------------------------------------------------
  // Demo enrichment: a fuller executive-demo dataset -- more departments,
  // ~50 employees, three fully-resourced Gantt-driven projects, multi-team
  // capacity, recruitment/contractors, actuals history, and a working
  // what-if scenario. Purely additive: nothing above this point is modified,
  // so existing e2e scripts that reference "NM-450 Traction Motor (sample)",
  // "Aurora Light Commercial EV Motor (sample)", "Priya Chandran", etc. by
  // name keep working unchanged.
  // ---------------------------------------------------------------------------

  console.log("Seeding demo departments & teams...");
  const deptResearch = await db.department.upsert({
    where: { businessUnitId_name: { businessUnitId: businessUnit.id, name: "Research" } },
    update: {},
    create: { name: "Research", businessUnitId: businessUnit.id },
  });
  const deptSimulation = await db.department.upsert({
    where: { businessUnitId_name: { businessUnitId: businessUnit.id, name: "Simulation" } },
    update: {},
    create: { name: "Simulation", businessUnitId: businessUnit.id },
  });
  const deptAME = await db.department.upsert({
    where: { businessUnitId_name: { businessUnitId: businessUnit.id, name: "Advanced Manufacturing Engineering" } },
    update: {},
    create: { name: "Advanced Manufacturing Engineering", businessUnitId: businessUnit.id },
  });

  const teamThermal = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptMech.id, name: "Thermal & Structural Design" } },
    update: {},
    create: { name: "Thermal & Structural Design", departmentId: deptMech.id, budgetedHeadcount: 8 },
  });
  const teamResearch = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptResearch.id, name: "Advanced Motor Research" } },
    update: {},
    create: { name: "Advanced Motor Research", departmentId: deptResearch.id, budgetedHeadcount: 7 },
  });
  const teamSimulation = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptSimulation.id, name: "Electromagnetic & Thermal Simulation" } },
    update: {},
    create: { name: "Electromagnetic & Thermal Simulation", departmentId: deptSimulation.id, budgetedHeadcount: 8 },
  });
  const teamManufacturing = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptAME.id, name: "Manufacturing Engineering" } },
    update: {},
    create: { name: "Manufacturing Engineering", departmentId: deptAME.id, budgetedHeadcount: 9 },
  });
  const teamCommercial = await db.team.upsert({
    where: { departmentId_name: { departmentId: deptPMO.id, name: "Commercial & Bids" } },
    update: {},
    create: { name: "Commercial & Bids", departmentId: deptPMO.id, budgetedHeadcount: 5 },
  });

  console.log("Seeding demo job roles & skills...");
  const demoRoleSeeds = [
    { name: "Research Engineer", disciplineCategory: "Research" },
    { name: "Principal Research Scientist", disciplineCategory: "Research" },
    { name: "Simulation Engineer", disciplineCategory: "Simulation" },
    { name: "Thermal Engineer", disciplineCategory: "Mechanical" },
    { name: "Structural Engineer", disciplineCategory: "Mechanical" },
    { name: "Manufacturing Engineer", disciplineCategory: "Manufacturing" },
    { name: "Process Engineer", disciplineCategory: "Manufacturing" },
    { name: "Quality Engineer", disciplineCategory: "Manufacturing" },
    { name: "Commercial Manager", disciplineCategory: "Programme" },
  ];
  const demoRoles = await Promise.all(
    demoRoleSeeds.map((r) => db.jobRole.upsert({ where: { name: r.name }, update: {}, create: r }))
  );
  for (const r of demoRoles) roleByName[r.name] = r;

  const skillCategoryResearch = await db.skillCategory.upsert({ where: { name: "Research" }, update: {}, create: { name: "Research" } });
  const skillCategorySimulation = await db.skillCategory.upsert({ where: { name: "Simulation" }, update: {}, create: { name: "Simulation" } });
  const skillCategoryManufacturing = await db.skillCategory.upsert({ where: { name: "Manufacturing" }, update: {}, create: { name: "Manufacturing" } });

  const skillEmSim = await db.skill.upsert({ where: { name: "Electromagnetic Simulation" }, update: {}, create: { name: "Electromagnetic Simulation", skillCategoryId: skillCategorySimulation.id, isCriticalSkill: true } });
  const skillThermalSim = await db.skill.upsert({ where: { name: "Thermal Simulation" }, update: {}, create: { name: "Thermal Simulation", skillCategoryId: skillCategorySimulation.id, isCriticalSkill: false } });
  // Deliberately scarce -- only one person on the whole org chart holds this,
  // so the skills matrix tells a real "critical skill shortage" story.
  const skillMaterials = await db.skill.upsert({ where: { name: "Materials Science" }, update: {}, create: { name: "Materials Science", skillCategoryId: skillCategoryResearch.id, isCriticalSkill: true } });
  const skillTopologies = await db.skill.upsert({ where: { name: "Advanced Motor Topologies" }, update: {}, create: { name: "Advanced Motor Topologies", skillCategoryId: skillCategoryResearch.id, isCriticalSkill: false } });
  const skillMfgProcess = await db.skill.upsert({ where: { name: "Manufacturing Process Design" }, update: {}, create: { name: "Manufacturing Process Design", skillCategoryId: skillCategoryManufacturing.id, isCriticalSkill: true } });
  const skillDFM = await db.skill.upsert({ where: { name: "DFM (Design for Manufacture)" }, update: {}, create: { name: "DFM (Design for Manufacture)", skillCategoryId: skillCategoryManufacturing.id, isCriticalSkill: false } });
  const skillStructural = await db.skill.upsert({ where: { name: "Structural Analysis" }, update: {}, create: { name: "Structural Analysis", skillCategoryId: skillCategory.id, isCriticalSkill: false } });
  const skillThermalAnalysis = await db.skill.upsert({ where: { name: "Thermal Analysis" }, update: {}, create: { name: "Thermal Analysis", skillCategoryId: skillCategory.id, isCriticalSkill: false } });

  console.log("Seeding ~50 employees across the org...");
  type DemoEmployeeSeed = {
    number: string;
    name: string;
    team: { id: number; departmentId: number };
    role: string;
    grade: string;
    rate: number;
    employmentType?: string;
    status?: string;
    startDate: string;
    isTeamManager?: boolean;
  };

  const demoEmployeeSeeds: DemoEmployeeSeed[] = [
    // Rotor & Stator Design
    { number: "EMP-1007", name: "Daniel Osei", team: teamRotorStator, role: "Rotor Design Engineer", grade: "Senior Engineer", rate: 54, startDate: "2020-04-06" },
    { number: "EMP-1008", name: "Freya Lindqvist", team: teamRotorStator, role: "Stator Design Engineer", grade: "Engineer", rate: 41, startDate: "2022-09-12" },
    { number: "EMP-1009", name: "Marcus Chen", team: teamRotorStator, role: "Rotor Design Engineer", grade: "Principal Engineer", rate: 65, startDate: "2017-01-16" },
    { number: "EMP-1010", name: "Aisha Bello", team: teamRotorStator, role: "Stator Design Engineer", grade: "Graduate Engineer", rate: 28, employmentType: "Graduate", startDate: "2025-09-01" },
    // Controls & Embedded Software
    { number: "EMP-1011", name: "Jonas Weber", team: teamControls, role: "Power Electronics Engineer", grade: "Principal Engineer", rate: 66, startDate: "2016-06-20" },
    { number: "EMP-1012", name: "Nadia Petrov", team: teamControls, role: "Controls Engineer", grade: "Senior Engineer", rate: 56, startDate: "2019-11-04" },
    { number: "EMP-1013", name: "Ryan O'Sullivan", team: teamControls, role: "Power Electronics Engineer", grade: "Engineer", rate: 43, employmentType: "Contractor", startDate: "2025-02-10" },
    { number: "EMP-1014", name: "Grace Kimani", team: teamControls, role: "Controls Engineer", grade: "Graduate Engineer", rate: 29, employmentType: "Graduate", startDate: "2025-09-01" },
    // Programme Office
    { number: "EMP-1015", name: "Hannah Whitmore", team: teamPMO, role: "Programme Manager", grade: "Engineering Manager", rate: 70, startDate: "2015-03-02" },
    { number: "EMP-1016", name: "Liam Fitzgerald", team: teamPMO, role: "Project Manager", grade: "Senior Engineer", rate: 53, startDate: "2020-01-13" },
    { number: "EMP-1017", name: "Elena Vasquez", team: teamPMO, role: "Project Manager", grade: "Engineer", rate: 45, employmentType: "Fixed Term", status: "On Leave", startDate: "2023-05-08" },
    // Thermal & Structural Design (new team -- first row is the manager)
    { number: "EMP-1018", name: "Robert Nakamura", team: teamThermal, role: "Thermal Engineer", grade: "Engineering Manager", rate: 68, startDate: "2014-08-11", isTeamManager: true },
    { number: "EMP-1019", name: "Chloe Bennett", team: teamThermal, role: "Thermal Engineer", grade: "Senior Engineer", rate: 55, startDate: "2018-10-01" },
    { number: "EMP-1020", name: "Ahmed Farouk", team: teamThermal, role: "Structural Engineer", grade: "Senior Engineer", rate: 54, startDate: "2019-02-25" },
    { number: "EMP-1021", name: "Ingrid Sorensen", team: teamThermal, role: "Structural Engineer", grade: "Engineer", rate: 42, startDate: "2021-11-15" },
    { number: "EMP-1022", name: "Kofi Mensah", team: teamThermal, role: "Thermal Engineer", grade: "Engineer", rate: 41, startDate: "2022-03-07" },
    { number: "EMP-1023", name: "Yuki Tanaka", team: teamThermal, role: "Structural Engineer", grade: "Graduate Engineer", rate: 27, employmentType: "Graduate", startDate: "2025-09-01" },
    { number: "EMP-1024", name: "Owen Murphy", team: teamThermal, role: "Thermal Engineer", grade: "Engineer", rate: 40, employmentType: "Agency", startDate: "2025-04-14" },
    // Advanced Motor Research (new team -- first row is the manager)
    { number: "EMP-1025", name: "Helena Bakker", team: teamResearch, role: "Principal Research Scientist", grade: "Principal Engineer", rate: 72, startDate: "2013-05-20", isTeamManager: true },
    { number: "EMP-1026", name: "Simon Achterberg", team: teamResearch, role: "Research Engineer", grade: "Senior Engineer", rate: 57, startDate: "2018-01-08" },
    { number: "EMP-1027", name: "Fatima Al-Rashid", team: teamResearch, role: "Research Engineer", grade: "Senior Engineer", rate: 56, startDate: "2019-06-17" },
    { number: "EMP-1028", name: "Patrick Doyle", team: teamResearch, role: "Research Engineer", grade: "Engineer", rate: 44, startDate: "2021-09-13" },
    { number: "EMP-1029", name: "Mariana Silva", team: teamResearch, role: "Research Engineer", grade: "Engineer", rate: 43, startDate: "2022-02-21" },
    { number: "EMP-1030", name: "Wei Zhang", team: teamResearch, role: "Research Engineer", grade: "Graduate Engineer", rate: 28, employmentType: "Graduate", startDate: "2025-09-01" },
    { number: "EMP-1031", name: "Ben Ostrowski", team: teamResearch, role: "Research Engineer", grade: "Engineer", rate: 42, employmentType: "Fixed Term", startDate: "2024-10-01" },
    // Electromagnetic & Thermal Simulation (new team -- first row is the manager)
    { number: "EMP-1032", name: "Anjali Rao", team: teamSimulation, role: "Simulation Engineer", grade: "Principal Engineer", rate: 64, startDate: "2015-07-06", isTeamManager: true },
    { number: "EMP-1033", name: "Lucas Meyer", team: teamSimulation, role: "Simulation Engineer", grade: "Senior Engineer", rate: 55, startDate: "2018-11-19" },
    { number: "EMP-1034", name: "Zainab Hussain", team: teamSimulation, role: "Simulation Engineer", grade: "Senior Engineer", rate: 54, startDate: "2019-04-08" },
    { number: "EMP-1035", name: "Erik Johansson", team: teamSimulation, role: "Simulation Engineer", grade: "Engineer", rate: 43, startDate: "2021-06-14" },
    { number: "EMP-1036", name: "Camille Dubois", team: teamSimulation, role: "Simulation Engineer", grade: "Engineer", rate: 42, startDate: "2022-08-22" },
    { number: "EMP-1037", name: "Nathan Wallace", team: teamSimulation, role: "Simulation Engineer", grade: "Graduate Engineer", rate: 27, employmentType: "Graduate", startDate: "2025-09-01" },
    { number: "EMP-1038", name: "Priyanka Desai", team: teamSimulation, role: "Simulation Engineer", grade: "Engineer", rate: 41, employmentType: "Contractor", startDate: "2025-01-20" },
    // Manufacturing Engineering (new team -- first row is the manager)
    { number: "EMP-1039", name: "George Ilinca", team: teamManufacturing, role: "Manufacturing Engineer", grade: "Engineering Manager", rate: 67, startDate: "2014-02-17", isTeamManager: true },
    { number: "EMP-1040", name: "Rachel Foster", team: teamManufacturing, role: "Manufacturing Engineer", grade: "Senior Engineer", rate: 53, startDate: "2018-05-29" },
    { number: "EMP-1041", name: "Diego Ramirez", team: teamManufacturing, role: "Process Engineer", grade: "Senior Engineer", rate: 52, startDate: "2019-09-16" },
    { number: "EMP-1042", name: "Naledi Dlamini", team: teamManufacturing, role: "Manufacturing Engineer", grade: "Engineer", rate: 40, startDate: "2021-03-01" },
    { number: "EMP-1043", name: "Tobias Krueger", team: teamManufacturing, role: "Process Engineer", grade: "Engineer", rate: 41, startDate: "2022-06-27" },
    { number: "EMP-1044", name: "Isla Cameron", team: teamManufacturing, role: "Manufacturing Engineer", grade: "Graduate Engineer", rate: 26, employmentType: "Graduate", startDate: "2025-09-01" },
    { number: "EMP-1045", name: "Adam Kowalski", team: teamManufacturing, role: "Quality Engineer", grade: "Engineer", rate: 39, employmentType: "Agency", startDate: "2025-05-19" },
    // Commercial & Bids (new team -- first row is the manager)
    { number: "EMP-1046", name: "Victoria Hargreaves", team: teamCommercial, role: "Commercial Manager", grade: "Engineering Manager", rate: 69, startDate: "2016-04-04", isTeamManager: true },
    { number: "EMP-1047", name: "Samuel Otieno", team: teamCommercial, role: "Project Manager", grade: "Senior Engineer", rate: 51, startDate: "2019-08-12" },
    { number: "EMP-1048", name: "Beatriz Almeida", team: teamCommercial, role: "Project Manager", grade: "Engineer", rate: 44, startDate: "2021-10-04" },
    { number: "EMP-1049", name: "Connor Blake", team: teamCommercial, role: "Project Manager", grade: "Engineer", rate: 40, employmentType: "Fixed Term", startDate: "2024-01-15" },
    { number: "EMP-1050", name: "Leah Goldstein", team: teamCommercial, role: "Project Manager", grade: "Graduate Engineer", rate: 27, employmentType: "Graduate", status: "Future Starter", startDate: "2026-10-01" },
  ];

  const employmentTypeCache = new Map<string, number>([["Permanent", permEmploymentType.id]]);
  const statusCache = new Map<string, number>([["Active", activeStatus.id]]);
  async function employmentTypeId(name: string): Promise<number> {
    const cached = employmentTypeCache.get(name);
    if (cached) return cached;
    const row = await db.employmentType.upsert({ where: { name }, update: {}, create: { name } });
    employmentTypeCache.set(name, row.id);
    return row.id;
  }
  async function statusId(name: string): Promise<number> {
    const cached = statusCache.get(name);
    if (cached) return cached;
    const row = await db.employeeStatus.upsert({ where: { name }, update: {}, create: { name } });
    statusCache.set(name, row.id);
    return row.id;
  }

  const employeeByName: Record<string, typeof manager> = { [manager.name]: manager };
  for (const e of engineers) employeeByName[e.name] = e;

  for (const e of demoEmployeeSeeds) {
    const created = await db.employee.create({
      data: {
        employeeNumber: e.number,
        name: e.name,
        managerEmployeeId: manager.id,
        departmentId: e.team.departmentId,
        teamId: e.team.id,
        jobRoleId: roleByName[e.role].id,
        gradeId: grades.find((g) => g.name === e.grade)!.id,
        employmentTypeId: await employmentTypeId(e.employmentType ?? "Permanent"),
        locationId: location.id,
        workingCalendarId: workingCalendar.id,
        contractHoursPerWeek: 37.5,
        standardWeeklyHours: 37.5,
        fte: 1,
        costRate: e.rate,
        employmentStartDate: new Date(e.startDate),
        statusId: await statusId(e.status ?? "Active"),
        holidayAllowanceDays: 25,
        trainingAllowanceDays: 5,
        utilisationTargetPct: 85,
      },
    });
    employeeByName[e.name] = created;
    if (e.isTeamManager) {
      await db.team.update({ where: { id: e.team.id }, data: { managerEmployeeId: created.id } });
    }
  }

  console.log("Seeding demo skills matrix...");
  const skillAssignments: { employee: string; skill: { id: number }; level: number; years: number; primary?: boolean }[] = [
    { employee: "Daniel Osei", skill: rotorSkill, level: 4, years: 7, primary: true },
    { employee: "Marcus Chen", skill: rotorSkill, level: 5, years: 14, primary: true },
    { employee: "Tom Harding", skill: feaSkill, level: 3, years: 4 },
    { employee: "Ahmed Farouk", skill: skillStructural, level: 5, years: 9, primary: true },
    { employee: "Ingrid Sorensen", skill: skillStructural, level: 3, years: 3 },
    { employee: "Robert Nakamura", skill: skillThermalAnalysis, level: 5, years: 15, primary: true },
    { employee: "Chloe Bennett", skill: skillThermalAnalysis, level: 4, years: 7 },
    { employee: "Kofi Mensah", skill: skillThermalAnalysis, level: 3, years: 3 },
    // Deliberately the ONLY holder of Materials Science -- a real critical
    // skill shortage the skills matrix can show, not a computed risk formula.
    { employee: "Helena Bakker", skill: skillMaterials, level: 5, years: 20, primary: true },
    { employee: "Simon Achterberg", skill: skillTopologies, level: 4, years: 8 },
    { employee: "Fatima Al-Rashid", skill: skillTopologies, level: 4, years: 6 },
    { employee: "Anjali Rao", skill: skillEmSim, level: 5, years: 12, primary: true },
    { employee: "Lucas Meyer", skill: skillEmSim, level: 4, years: 6 },
    { employee: "Zainab Hussain", skill: skillEmSim, level: 4, years: 5 },
    { employee: "Erik Johansson", skill: skillThermalSim, level: 3, years: 4 },
    { employee: "Camille Dubois", skill: skillThermalSim, level: 3, years: 3 },
    { employee: "George Ilinca", skill: skillMfgProcess, level: 5, years: 13, primary: true },
    { employee: "Rachel Foster", skill: skillMfgProcess, level: 4, years: 7 },
    { employee: "Diego Ramirez", skill: skillDFM, level: 4, years: 6 },
    { employee: "Tobias Krueger", skill: skillDFM, level: 3, years: 3 },
    { employee: "Mei Lin Foster", skill: controlsSkill, level: 4, years: 7 },
    { employee: "Jonas Weber", skill: controlsSkill, level: 5, years: 15, primary: true },
    { employee: "Nadia Petrov", skill: controlsSkill, level: 4, years: 6 },
  ];
  for (const sa of skillAssignments) {
    const emp = employeeByName[sa.employee];
    await db.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: emp.id, skillId: sa.skill.id } },
      update: {},
      create: {
        employeeId: emp.id,
        skillId: sa.skill.id,
        competencyLevel: sa.level,
        yearsExperience: sa.years,
        approved: true,
        isPrimarySkill: sa.primary ?? false,
        isSecondarySkill: !sa.primary,
      },
    });
  }

  console.log("Seeding demo customer, programme & three more projects...");
  const customerMeridian = await db.customer.upsert({
    where: { name: "Meridian Industrial Group (sample)" },
    update: {},
    create: { name: "Meridian Industrial Group (sample)", accountManagerEmployeeId: employeeByName["Victoria Hargreaves"].id },
  });
  const programmeIndustrial =
    (await db.programme.findFirst({ where: { name: "Industrial Drives Platform (sample)" } })) ??
    (await db.programme.create({
      data: { name: "Industrial Drives Platform (sample)", customerId: customerMeridian.id, programmeManagerEmployeeId: employeeByName["Hannah Whitmore"].id },
    }));

  const statusPreferred = await db.projectStatus.upsert({ where: { name: "Preferred" }, update: {}, create: { name: "Preferred", defaultProbabilityPct: 70, sortOrder: 3 } });
  const statusProspect = await db.projectStatus.upsert({ where: { name: "Prospect" }, update: {}, create: { name: "Prospect", defaultProbabilityPct: 25, sortOrder: 1 } });
  const priorityCritical = await db.priority.upsert({ where: { name: "Critical" }, update: {}, create: { name: "Critical", sortOrder: 0 } });
  const priorityLow = await db.priority.upsert({ where: { name: "Low" }, update: {}, create: { name: "Low", sortOrder: 3 } });

  // At risk: Manufacturing Engineering is double-booked against NM-450's
  // production ramp-up at the same time (see the capacity crunch below) --
  // Red is the honest RAG for this one, not decoration.
  const projectFalcon = await db.project.create({
    data: {
      projectCode: "PRJ-FALCON",
      name: "Falcon HD Industrial Motor (sample)",
      customerId: customerMeridian.id,
      programmeId: programmeIndustrial.id,
      projectManagerEmployeeId: employeeByName["Samuel Otieno"].id,
      businessUnitId: businessUnit.id,
      priorityId: priorityCritical.id,
      projectStatusId: statusCommitted.id,
      lifecyclePhase: "Detail Design",
      startDate: new Date("2026-03-02"),
      finishDate: new Date("2027-01-29"),
      revenueForecast: 5600000,
      budgetCost: 3650000,
      targetMarginPct: 30,
      strategicImportance: true,
      ragStatus: "Red",
    },
  });
  await db.project.create({
    data: {
      projectCode: "PRJ-ZEPHYR",
      name: "Zephyr Two-Wheeler Motor (sample)",
      customerId: customer.id,
      projectManagerEmployeeId: employeeByName["Elena Vasquez"].id,
      businessUnitId: businessUnit.id,
      priorityId: priorityLow.id,
      projectStatusId: statusProspect.id,
      lifecyclePhase: "Concept",
      startDate: new Date("2027-01-04"),
      finishDate: new Date("2027-10-29"),
      revenueForecast: 450000,
      budgetCost: 290000,
      targetMarginPct: 28,
      ragStatus: "Amber",
    },
  });
  const projectTitan = await db.project.create({
    data: {
      projectCode: "PRJ-TITAN",
      name: "Titan Off-Highway Motor (sample)",
      customerId: customerMeridian.id,
      programmeId: programmeIndustrial.id,
      projectManagerEmployeeId: employeeByName["Liam Fitzgerald"].id,
      businessUnitId: businessUnit.id,
      priorityId: priorityHigh.id,
      projectStatusId: statusPreferred.id,
      lifecyclePhase: "Feasibility",
      startDate: new Date("2026-11-02"),
      finishDate: new Date("2027-12-17"),
      revenueForecast: 3100000,
      budgetCost: 1950000,
      targetMarginPct: 35,
      ragStatus: "Green",
    },
  });

  console.log("Seeding task-driven Gantt charts & resource plans for all three flagship projects...");
  async function addTask(projectId: number, name: string, durationDays: number, ownerTeamId: number, completedAt: string | null) {
    return db.task.create({ data: { projectId, name, durationDays, ownerTeamId, completedAt: completedAt ? new Date(completedAt) : null } });
  }
  async function addDependency(predecessorTaskId: number, successorTaskId: number, lagDays = 0) {
    await db.taskDependency.create({ data: { predecessorTaskId, successorTaskId, lagDays } });
  }
  async function addAssignment(taskId: number, employeeName: string, fte: number) {
    await db.taskAssignment.create({ data: { taskId, employeeId: employeeByName[employeeName].id, fte } });
  }

  // --- NM-450 Traction Motor: flagship, well underway, nearing production ---
  const nm1 = await addTask(projectWon.id, "Detailed Design Release", 25, teamRotorStator.id, "2026-02-09");
  const nm2 = await addTask(projectWon.id, "Electromagnetic Simulation Sign-off", 20, teamSimulation.id, "2026-03-09");
  const nm4 = await addTask(projectWon.id, "Power Electronics Integration", 15, teamControls.id, "2026-03-30");
  const nm3 = await addTask(projectWon.id, "Prototype Build", 30, teamManufacturing.id, "2026-04-20");
  const nm5 = await addTask(projectWon.id, "Validation Testing", 30, teamRotorStator.id, "2026-06-01");
  const nm6 = await addTask(projectWon.id, "Reliability & Environmental Testing", 25, teamThermal.id, "2026-07-06");
  const nm7 = await addTask(projectWon.id, "Production Readiness Review", 15, teamPMO.id, null);
  const nm8 = await addTask(projectWon.id, "Start of Production", 10, teamManufacturing.id, null);
  await addDependency(nm1.id, nm2.id);
  await addDependency(nm2.id, nm4.id);
  await addDependency(nm2.id, nm3.id);
  await addDependency(nm3.id, nm5.id);
  await addDependency(nm4.id, nm5.id);
  await addDependency(nm5.id, nm6.id);
  await addDependency(nm6.id, nm7.id);
  await addDependency(nm7.id, nm8.id);
  await addAssignment(nm1.id, "Priya Chandran", 0.6);
  await addAssignment(nm1.id, "Daniel Osei", 0.5);
  await addAssignment(nm1.id, "Marcus Chen", 0.4);
  await addAssignment(nm2.id, "Anjali Rao", 0.5);
  await addAssignment(nm2.id, "Lucas Meyer", 0.6);
  await addAssignment(nm4.id, "Mei Lin Foster", 0.5);
  await addAssignment(nm4.id, "Jonas Weber", 0.5);
  await addAssignment(nm3.id, "George Ilinca", 0.4);
  await addAssignment(nm3.id, "Rachel Foster", 0.6);
  await addAssignment(nm3.id, "Diego Ramirez", 0.5);
  await addAssignment(nm5.id, "Tom Harding", 0.5);
  await addAssignment(nm5.id, "Ahmed Farouk", 0.4);
  await addAssignment(nm5.id, "Nadia Petrov", 0.4);
  await addAssignment(nm6.id, "Chloe Bennett", 0.6);
  await addAssignment(nm6.id, "Kofi Mensah", 0.5);
  await addAssignment(nm7.id, "Sofia Marchetti", 0.3);
  await addAssignment(nm7.id, "Hannah Whitmore", 0.3);
  await addAssignment(nm8.id, "George Ilinca", 0.5);
  await addAssignment(nm8.id, "Naledi Dlamini", 0.5);

  // --- Aurora Light Commercial EV Motor: concept-stage, hasn't started yet ---
  const au1 = await addTask(projectRFQ.id, "Concept Feasibility Study", 20, teamResearch.id, null);
  const au2 = await addTask(projectRFQ.id, "Preliminary EM Design", 15, teamSimulation.id, null);
  const au3 = await addTask(projectRFQ.id, "Cost & Manufacturability Review", 10, teamManufacturing.id, null);
  const au4 = await addTask(projectRFQ.id, "RFQ Technical Proposal", 10, teamCommercial.id, null);
  await addDependency(au1.id, au2.id);
  await addDependency(au1.id, au3.id);
  await addDependency(au2.id, au4.id);
  await addDependency(au3.id, au4.id);
  await addAssignment(au1.id, "Helena Bakker", 0.3);
  await addAssignment(au1.id, "Simon Achterberg", 0.4);
  await addAssignment(au2.id, "Zainab Hussain", 0.4);
  await addAssignment(au2.id, "Erik Johansson", 0.4);
  await addAssignment(au3.id, "Tobias Krueger", 0.3);
  await addAssignment(au4.id, "Victoria Hargreaves", 0.3);
  await addAssignment(au4.id, "Samuel Otieno", 0.4);

  // --- Falcon HD Industrial Motor: at risk -- Manufacturing Process Design
  // has stalled (no completedAt) with five people already committed to it,
  // the same team NM-450's production ramp-up leans on at the same time.
  const fa1 = await addTask(projectFalcon.id, "Requirements Freeze", 10, teamPMO.id, "2026-03-16");
  const fa2 = await addTask(projectFalcon.id, "Detailed Design", 35, teamThermal.id, "2026-05-18");
  const fa3 = await addTask(projectFalcon.id, "EM & Thermal Simulation", 25, teamSimulation.id, "2026-06-29");
  const fa4 = await addTask(projectFalcon.id, "Manufacturing Process Design", 30, teamManufacturing.id, null);
  const fa5 = await addTask(projectFalcon.id, "Prototype Build & Test", 25, teamManufacturing.id, null);
  const fa6 = await addTask(projectFalcon.id, "Customer Design Review", 5, teamCommercial.id, null);
  await addDependency(fa1.id, fa2.id);
  await addDependency(fa2.id, fa3.id);
  await addDependency(fa3.id, fa4.id);
  await addDependency(fa4.id, fa5.id);
  await addDependency(fa5.id, fa6.id);
  await addAssignment(fa1.id, "Samuel Otieno", 0.3);
  await addAssignment(fa2.id, "Robert Nakamura", 0.5);
  await addAssignment(fa2.id, "Ingrid Sorensen", 0.5);
  await addAssignment(fa3.id, "Zainab Hussain", 0.5);
  await addAssignment(fa3.id, "Camille Dubois", 0.4);
  await addAssignment(fa4.id, "George Ilinca", 0.6);
  await addAssignment(fa4.id, "Rachel Foster", 0.6);
  await addAssignment(fa4.id, "Diego Ramirez", 0.6);
  await addAssignment(fa4.id, "Naledi Dlamini", 0.6);
  await addAssignment(fa4.id, "Tobias Krueger", 0.5);
  // Deliberately NOT George/Rachel/Diego/Naledi/Tobias (fa4's team) -- a
  // successor task sharing an assignee with its immediate predecessor can
  // land the same employee+project in the same boundary week on both tasks,
  // which collides on ForecastAllocation's grid-cell unique constraint.
  await addAssignment(fa5.id, "Isla Cameron", 0.4);
  await addAssignment(fa5.id, "Zainab Hussain", 0.4);
  await addAssignment(fa6.id, "Victoria Hargreaves", 0.3);

  // Standalone CPM scheduler + task-forecast generator, mirroring
  // src/lib/task-service.ts's recomputeProjectSchedule exactly -- but that
  // function reads the active scenario via next/headers' cookies(), which
  // only works inside a request; this script takes scenarioId explicitly.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  function mondaysBetweenDemo(start: Date, end: Date): Date[] {
    const result: Date[] = [];
    let cursor = mondayOf(start);
    while (cursor <= end) {
      result.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + WEEK_MS);
    }
    return result;
  }
  async function scheduleDemoProject(projectId: number, scenarioId: number, resourceTypeId: number, forecastSourceId: number) {
    const [project, tasks, assignments, dependencies] = await Promise.all([
      db.project.findUniqueOrThrow({ where: { id: projectId }, select: { startDate: true } }),
      db.task.findMany({ where: { projectId }, select: { id: true, durationDays: true, manualStartDate: true, completedAt: true } }),
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
    const taskNodes: TaskNode[] = tasks.map((t) => ({ id: t.id, durationDays: t.durationDays, manualStartDate: t.manualStartDate, completedAt: t.completedAt }));
    const depEdges: DependencyEdge[] = dependencies;
    const schedule = computeSchedule(taskNodes, depEdges, anchor);

    await Promise.all(
      tasks.map((t) => {
        const s = schedule.get(t.id);
        if (!s) return Promise.resolve();
        return db.task.update({ where: { id: t.id }, data: { computedStartDate: s.startDate, computedEndDate: s.endDate, isCritical: s.isCritical } });
      })
    );

    const assignedTeamIds = Array.from(new Set(assignments.map((a) => a.employee.teamId).filter((id): id is number => id !== null)));
    if (assignedTeamIds.length > 0) {
      await Promise.all(
        assignedTeamIds.map((teamId) => db.projectTeam.upsert({ where: { projectId_teamId: { projectId, teamId } }, update: {}, create: { projectId, teamId } }))
      );
    }

    const assignmentsByTask = new Map<number, typeof assignments>();
    for (const a of assignments) {
      const list = assignmentsByTask.get(a.taskId) ?? [];
      list.push(a);
      assignmentsByTask.set(a.taskId, list);
    }

    for (const t of tasks) {
      await db.forecastAllocation.deleteMany({ where: { taskId: t.id } });
      const s = schedule.get(t.id);
      const taskAssignments = assignmentsByTask.get(t.id) ?? [];
      if (!s || taskAssignments.length === 0) continue;

      const weeks = mondaysBetweenDemo(s.startDate, s.endDate);
      const weekRows = await Promise.all(
        weeks.map((d) => db.calendarDate.upsert({ where: { dateKey: dateKeyFor(d) }, update: {}, create: buildCalendarDateRow(d) }))
      );
      const dateKeys = weekRows.map((r) => r.dateKey);

      const allocRows = [];
      for (const assignment of taskAssignments) {
        const weeklyStandard = Number(assignment.employee.standardWeeklyHours);
        for (let i = 0; i < weeks.length; i++) {
          const hours = weeklyHoursForTask(s.startDate, s.endDate, weeks[i], weeklyStandard) * Number(assignment.fte);
          if (hours <= 0) continue;
          allocRows.push({ scenarioId, employeeId: assignment.employeeId, projectId, dateKey: dateKeys[i], resourceTypeId, forecastSourceId, taskId: t.id, hours: hours.toFixed(2) });
        }
      }
      if (allocRows.length > 0) await db.forecastAllocation.createMany({ data: allocRows });
    }
  }

  await scheduleDemoProject(projectWon.id, scenarioBaseline.id, resourceTypeEmployee.id, sourceProject.id);
  await scheduleDemoProject(projectRFQ.id, scenarioBaseline.id, resourceTypeEmployee.id, sourceProject.id);
  await scheduleDemoProject(projectFalcon.id, scenarioBaseline.id, resourceTypeEmployee.id, sourceProject.id);

  console.log("Seeding lightweight forecast for Titan (Zephyr stays unresourced)...");
  // Zephyr is deliberately left with zero teams/hours -- a Prospect-stage
  // project realistically has nothing committed yet, and it doubles as the
  // one genuinely empty project the forecast-grid/Gantt-drag e2e scripts
  // need (they assume a single-team, single-task blank canvas; NM-450,
  // Aurora and Falcon are all now intentionally busy demo projects).
  await db.projectTeam.upsert({ where: { projectId_teamId: { projectId: projectTitan.id, teamId: teamCommercial.id } }, update: {}, create: { projectId: projectTitan.id, teamId: teamCommercial.id } });
  for (let w = 0; w < 8; w++) {
    const weekDate = new Date(firstMonday);
    weekDate.setUTCDate(firstMonday.getUTCDate() + w * 7);
    const calRow = await db.calendarDate.upsert({ where: { dateKey: dateKeyFor(weekDate) }, update: {}, create: buildCalendarDateRow(weekDate) });
    await db.forecastAllocation.create({
      data: { scenarioId: scenarioBaseline.id, projectId: projectTitan.id, teamId: teamCommercial.id, resourceTypeId: resourceTypeEmployee.id, forecastSourceId: sourceProject.id, dateKey: calRow.dateKey, hours: 20, fte: 0.5 },
    });
  }

  console.log("Seeding extended multi-team, multi-month capacity...");
  const allTeamsCapacity: { team: { id: number }; headcount: number }[] = [
    { team: teamRotorStator, headcount: 12 },
    { team: teamControls, headcount: 8 },
    { team: teamPMO, headcount: 4 },
    { team: teamThermal, headcount: 8 },
    { team: teamResearch, headcount: 7 },
    { team: teamSimulation, headcount: 8 },
    { team: teamManufacturing, headcount: 9 },
    { team: teamCommercial, headcount: 5 },
  ];
  for (let m = -3; m < 7; m++) {
    const monthStart = new Date(Date.UTC(firstMonday.getUTCFullYear(), firstMonday.getUTCMonth() + m, 1));
    const calendarRow = buildCalendarDateRow(monthStart);
    await db.calendarDate.upsert({ where: { dateKey: calendarRow.dateKey }, update: {}, create: calendarRow });

    for (const { team, headcount } of allTeamsCapacity) {
      // Manufacturing Engineering is deliberately under-resourced for the
      // three months either side of "now" -- NM-450's production ramp-up and
      // Falcon's stalled build both draw on the same handful of people at
      // once, so utilisation reads over 100% here specifically, not as
      // uniform noise across every team.
      const isCrunch = team.id === teamManufacturing.id && m >= -1 && m <= 1;
      const effectiveHeadcount = isCrunch ? Math.round(headcount * 0.5) : headcount;
      const standardHours = effectiveHeadcount * 130;
      const capacityData = {
        budgetedHeadcount: headcount,
        actualHeadcount: effectiveHeadcount,
        vacancies: Math.max(0, headcount - effectiveHeadcount),
        contractorsCount: team.id === teamControls.id || team.id === teamSimulation.id ? 1 : 0,
        agencyCount: team.id === teamThermal.id || team.id === teamManufacturing.id ? 1 : 0,
        graduateIntakeCount: 1,
        futureHiresCount: team.id === teamCommercial.id ? 1 : 0,
        leaversCount: 0,
        standardHours,
        trainingHours: effectiveHeadcount * 1.25,
        businessShutdownHours: 0,
        holidayHours: effectiveHeadcount * 1.875,
        internalMeetingHours: effectiveHeadcount * 1.25,
        bauAllowanceHours: effectiveHeadcount * 2.5,
        managementOverheadHours: effectiveHeadcount * 1.25,
      };

      // update (not `{}`) so this pass's headcount-scaled numbers also
      // replace the small illustrative placeholders the original seed left
      // on Rotor & Stator / Controls for their overlapping months -- those
      // teams have real headcount now (7-8 people, not the original 3-6),
      // and leaving the old capacity untouched produced a nonsensical >300%
      // utilisation reading once this demo's heavier task-driven demand
      // landed on top of it.
      await db.capacity.upsert({
        where: { teamId_scenarioId_dateKey: { teamId: team.id, scenarioId: scenarioBaseline.id, dateKey: calendarRow.dateKey } },
        update: capacityData,
        create: { teamId: team.id, scenarioId: scenarioBaseline.id, dateKey: calendarRow.dateKey, ...capacityData },
      });
    }
  }

  console.log("Seeding actuals history & import batch review queue...");
  const importBatch1 = await db.importBatch.create({
    data: { sourceSystem: "SAP Timesheets (sample)", sourceFileName: "timesheets_2026_q2.csv", rowCount: 480, exceptionCount: 2 },
  });
  const importBatch2 = await db.importBatch.create({
    data: { sourceSystem: "SAP Timesheets (sample)", sourceFileName: "timesheets_2026_q3.csv", rowCount: 512, exceptionCount: 1 },
  });
  await db.importException.createMany({
    data: [
      { importBatchId: importBatch1.id, rowNumber: 214, rawData: '{"employeeNumber":"EMP-9999","hours":37.5}', reason: "No employee found with number EMP-9999" },
      { importBatchId: importBatch1.id, rowNumber: 401, rawData: '{"projectCode":"PRJ-OLD","hours":12}', reason: "No project found with code PRJ-OLD" },
      { importBatchId: importBatch2.id, rowNumber: 88, rawData: '{"employeeNumber":"EMP-1050","hours":37.5}', reason: "Employee has not started yet (future starter)" },
    ],
  });

  const pastWeekRows: { team: { id: number }; project: { id: number }; baseHours: number; repEmployee: string }[] = [
    { team: teamRotorStator, project: projectWon, baseHours: 260, repEmployee: "Priya Chandran" },
    { team: teamSimulation, project: projectWon, baseHours: 150, repEmployee: "Anjali Rao" },
    { team: teamManufacturing, project: projectFalcon, baseHours: 180, repEmployee: "George Ilinca" },
  ];
  for (let w = 20; w >= 1; w--) {
    const weekDate = new Date(firstMonday);
    weekDate.setUTCDate(firstMonday.getUTCDate() - w * 7);
    const calRow = await db.calendarDate.upsert({ where: { dateKey: dateKeyFor(weekDate) }, update: {}, create: buildCalendarDateRow(weekDate) });
    const batch = w > 10 ? importBatch1 : importBatch2;

    for (const { team, project, baseHours, repEmployee } of pastWeekRows) {
      const forecastHours = baseHours + (w % 3) * 10;
      await db.forecastAllocation.create({
        data: {
          scenarioId: scenarioBaseline.id,
          projectId: project.id,
          teamId: team.id,
          resourceTypeId: resourceTypeEmployee.id,
          forecastSourceId: sourceProject.id,
          dateKey: calRow.dateKey,
          hours: forecastHours,
          fte: Number((forecastHours / 37.5).toFixed(2)),
        },
      });

      // Actuals land close to forecast but not exact -- deterministic small
      // swing so Forecast Accuracy has something real, non-perfect to show.
      const variance = ((w * 7) % 11) - 5;
      const actualHours = Math.max(0, forecastHours + variance);
      await db.actualAllocation.create({
        data: {
          employeeId: employeeByName[repEmployee].id,
          projectId: project.id,
          forecastSourceId: sourceProject.id,
          dateKey: calRow.dateKey,
          actualHours,
          importBatchId: batch.id,
        },
      });
    }
  }

  console.log("Seeding demo recruitment pipeline...");
  const [recruitInterviewing, recruitOfferMade, recruitRecruiting, recruitOfferAccepted] = await Promise.all([
    db.recruitmentStatus.upsert({ where: { name: "Interviewing" }, update: {}, create: { name: "Interviewing", sortOrder: 3 } }),
    db.recruitmentStatus.upsert({ where: { name: "Offer Made" }, update: {}, create: { name: "Offer Made", sortOrder: 4 } }),
    db.recruitmentStatus.upsert({ where: { name: "Recruiting" }, update: {}, create: { name: "Recruiting", sortOrder: 2 } }),
    db.recruitmentStatus.upsert({ where: { name: "Offer Accepted" }, update: {}, create: { name: "Offer Accepted", sortOrder: 5 } }),
  ]);
  await db.recruitment.createMany({
    data: [
      { teamId: teamThermal.id, jobRoleId: roleByName["Structural Engineer"].id, recruitmentStatusId: recruitInterviewing.id, approvedDate: new Date("2026-06-01"), targetStartDate: new Date("2026-10-01") },
      { teamId: teamSimulation.id, jobRoleId: roleByName["Simulation Engineer"].id, recruitmentStatusId: recruitOfferMade.id, approvedDate: new Date("2026-05-15"), targetStartDate: new Date("2026-09-15") },
      { teamId: teamManufacturing.id, jobRoleId: roleByName["Manufacturing Engineer"].id, recruitmentStatusId: recruitRecruiting.id, approvedDate: new Date("2026-07-01"), targetStartDate: new Date("2026-11-01") },
      { teamId: teamManufacturing.id, jobRoleId: roleByName["Process Engineer"].id, recruitmentStatusId: recruitStatusApproved.id, approvedDate: new Date("2026-08-01"), targetStartDate: new Date("2026-12-01") },
      { teamId: teamResearch.id, jobRoleId: roleByName["Research Engineer"].id, recruitmentStatusId: recruitOfferAccepted.id, approvedDate: new Date("2026-04-20"), targetStartDate: new Date("2026-09-01") },
    ],
  });

  console.log("Seeding demo contractors...");
  await db.contractor.createMany({
    data: [
      { name: "Marcus Webb", agencyName: "TechStaff Solutions (sample)", jobRoleId: roleByName["Power Electronics Engineer"].id, costRate: 85, contractStartDate: new Date("2026-04-01"), contractEndDate: new Date("2027-03-31"), teamId: teamControls.id },
      { name: "Elena Petrova", agencyName: "Precision Engineering Contractors (sample)", jobRoleId: roleByName["Manufacturing Engineer"].id, costRate: 78, contractStartDate: new Date("2026-05-01"), contractEndDate: new Date("2026-12-31"), teamId: teamManufacturing.id },
      { name: "James O'Brien", agencyName: "FlexEng Ltd (sample)", jobRoleId: roleByName["Structural Engineer"].id, costRate: 72, contractStartDate: new Date("2026-06-15"), contractEndDate: new Date("2027-01-15"), teamId: teamThermal.id },
    ],
  });

  console.log("Seeding a working what-if branch scenario...");
  const branchScenario = await db.scenario.upsert({
    where: { name: "Q1 Growth Case (sample)" },
    update: {},
    create: { name: "Q1 Growth Case (sample)", isActive: true, baseScenarioId: scenarioBaseline.id },
  });
  const [adjWin, adjDelay] = await Promise.all([
    db.adjustmentType.upsert({ where: { name: "Win" }, update: {}, create: { name: "Win" } }),
    db.adjustmentType.upsert({ where: { name: "Delay" }, update: {}, create: { name: "Delay" } }),
  ]);
  const falconCrunchWeek = new Date(firstMonday);
  falconCrunchWeek.setUTCDate(firstMonday.getUTCDate() + 7);
  const falconCrunchRow = await db.calendarDate.upsert({ where: { dateKey: dateKeyFor(falconCrunchWeek) }, update: {}, create: buildCalendarDateRow(falconCrunchWeek) });
  await db.scenarioAdjustment.createMany({
    data: [
      { scenarioId: branchScenario.id, adjustmentTypeId: adjWin.id, projectId: projectRFQ.id, notes: "Aurora RFQ verbally confirmed by customer procurement -- modelling as Won.", createdBy: "steve@yasa.local" },
      { scenarioId: branchScenario.id, adjustmentTypeId: adjDelay.id, projectId: projectFalcon.id, deltaWeeks: 6, effectiveDateKey: falconCrunchRow.dateKey, notes: "Testing a 6-week slip to relieve the Manufacturing Engineering crunch.", createdBy: "steve@yasa.local" },
    ],
  });

  console.log("Seeding additional demo login users...");
  const pmoPasswordHash = await bcrypt.hash("pmo", 12);
  await db.user.upsert({
    where: { email: "sarah.pmo@yasa.local" },
    update: {},
    create: { email: "sarah.pmo@yasa.local", name: "Sarah Whitmore", passwordHash: pmoPasswordHash, appRole: "PMO" },
  });
  const viewerPasswordHash = await bcrypt.hash("viewer", 12);
  await db.user.upsert({
    where: { email: "exec.viewer@yasa.local" },
    update: {},
    create: { email: "exec.viewer@yasa.local", name: "Exec Viewer", passwordHash: viewerPasswordHash, appRole: "VIEWER" },
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
