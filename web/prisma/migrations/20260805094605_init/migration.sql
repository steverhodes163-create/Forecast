-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'PMO', 'FINANCE', 'HR', 'ENGINEERING_LEAD', 'VIEWER');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('DIRECT_LABOUR', 'INDIRECT_LABOUR', 'CONTRACTOR', 'AGENCY', 'CAPITALISED_ENGINEERING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "appRole" "AppRole" NOT NULL DEFAULT 'VIEWER',
    "employeeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "businessUnitId" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "managerEmployeeId" INTEGER,
    "budgetedHeadcount" DECIMAL(6,2),
    "notes" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "managerEmployeeId" INTEGER,
    "departmentId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "jobRoleId" INTEGER NOT NULL,
    "gradeId" INTEGER,
    "employmentTypeId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "workingCalendarId" INTEGER NOT NULL,
    "contractHoursPerWeek" DECIMAL(5,2) NOT NULL,
    "standardWeeklyHours" DECIMAL(5,2) NOT NULL,
    "fte" DECIMAL(4,3) NOT NULL,
    "costRate" DECIMAL(10,2) NOT NULL,
    "chargeRate" DECIMAL(10,2),
    "employmentStartDate" TIMESTAMP(3) NOT NULL,
    "employmentEndDate" TIMESTAMP(3),
    "statusId" INTEGER NOT NULL,
    "holidayAllowanceDays" DECIMAL(4,1),
    "trainingAllowanceDays" DECIMAL(4,1),
    "utilisationTargetPct" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRole" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "disciplineCategory" TEXT,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EmploymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EmployeeStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "regionCode" TEXT,
    "workingCalendarId" INTEGER NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingCalendar" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "standardWeeklyHours" DECIMAL(5,2) NOT NULL,
    "countryCode" TEXT NOT NULL,

    CONSTRAINT "WorkingCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDate" (
    "dateKey" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dayName" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "monthName" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriod" INTEGER NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL,
    "isPublicHoliday" BOOLEAN NOT NULL,

    CONSTRAINT "CalendarDate_pkey" PRIMARY KEY ("dateKey")
);

-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "skillCategoryId" INTEGER NOT NULL,
    "isCriticalSkill" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "competencyLevel" INTEGER NOT NULL,
    "yearsExperience" DECIMAL(4,1),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "lastValidatedDate" DATE,
    "isPrimarySkill" BOOLEAN NOT NULL DEFAULT false,
    "isSecondarySkill" BOOLEAN NOT NULL DEFAULT false,
    "isFutureSkill" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "accountManagerEmployeeId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "programmeManagerEmployeeId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "defaultProbabilityPct" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Priority" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "programmeId" INTEGER,
    "projectManagerEmployeeId" INTEGER,
    "businessUnitId" INTEGER NOT NULL,
    "priorityId" INTEGER NOT NULL,
    "projectStatusId" INTEGER NOT NULL,
    "lifecyclePhase" TEXT,
    "probabilityOverridePct" DECIMAL(5,2),
    "startDate" DATE,
    "finishDate" DATE,
    "revenueForecast" DECIMAL(14,2),
    "budgetCost" DECIMAL(14,2),
    "targetMarginPct" DECIMAL(5,2),
    "strategicImportance" BOOLEAN NOT NULL DEFAULT false,
    "ragStatus" TEXT,
    "gateway" TEXT,
    "technology" TEXT,
    "platform" TEXT,
    "costCentreId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ResourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "agencyName" TEXT,
    "jobRoleId" INTEGER,
    "costRate" DECIMAL(10,2) NOT NULL,
    "contractStartDate" DATE,
    "contractEndDate" DATE,
    "teamId" INTEGER,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCentre" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "CostCentre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseScenarioId" INTEGER,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastSource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isProjectLinked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ForecastSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "RecruitmentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AdjustmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" SERIAL NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "refreshTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "exceptionCount" INTEGER NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastAllocation" (
    "id" SERIAL NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "employeeId" INTEGER,
    "teamId" INTEGER,
    "skillId" INTEGER,
    "contractorId" INTEGER,
    "resourceTypeId" INTEGER NOT NULL,
    "forecastSourceId" INTEGER NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "fte" DECIMAL(6,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualAllocation" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "forecastSourceId" INTEGER NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "actualHours" DECIMAL(8,2) NOT NULL,
    "importBatchId" INTEGER NOT NULL,

    CONSTRAINT "ActualAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capacity" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "budgetedHeadcount" DECIMAL(6,2) NOT NULL,
    "actualHeadcount" DECIMAL(6,2) NOT NULL,
    "vacancies" DECIMAL(6,2) NOT NULL,
    "contractorsCount" DECIMAL(6,2) NOT NULL,
    "agencyCount" DECIMAL(6,2) NOT NULL,
    "graduateIntakeCount" DECIMAL(6,2) NOT NULL,
    "futureHiresCount" DECIMAL(6,2) NOT NULL,
    "leaversCount" DECIMAL(6,2) NOT NULL,
    "standardHours" DECIMAL(10,2) NOT NULL,
    "trainingHours" DECIMAL(10,2) NOT NULL,
    "businessShutdownHours" DECIMAL(10,2) NOT NULL,
    "holidayHours" DECIMAL(10,2) NOT NULL,
    "internalMeetingHours" DECIMAL(10,2) NOT NULL,
    "bauAllowanceHours" DECIMAL(10,2) NOT NULL,
    "managementOverheadHours" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recruitment" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "jobRoleId" INTEGER NOT NULL,
    "recruitmentStatusId" INTEGER NOT NULL,
    "approvedDate" DATE,
    "targetStartDate" DATE,
    "actualStartDate" DATE,
    "cancelledDate" DATE,
    "notes" TEXT,

    CONSTRAINT "Recruitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "costCentreId" INTEGER NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "dateKey" INTEGER NOT NULL,
    "budgetAmount" DECIMAL(14,2) NOT NULL,
    "costCategory" "CostCategory" NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioAdjustment" (
    "id" SERIAL NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "adjustmentTypeId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "teamId" INTEGER,
    "deltaWeeks" INTEGER,
    "effectiveDateKey" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasureCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "measureGroup" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "businessQuestionTags" TEXT[],

    CONSTRAINT "MeasureCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_name_key" ON "BusinessUnit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_businessUnitId_name_key" ON "Department"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_departmentId_name_key" ON "Team"("departmentId", "name");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");

-- CreateIndex
CREATE INDEX "Employee_managerEmployeeId_idx" ON "Employee"("managerEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_name_key" ON "JobRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_name_key" ON "Grade"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentType_name_key" ON "EmploymentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeStatus_name_key" ON "EmployeeStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingCalendar_name_key" ON "WorkingCalendar"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_locationId_holidayDate_key" ON "PublicHoliday"("locationId", "holidayDate");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDate_date_key" ON "CalendarDate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCategory_name_key" ON "SkillCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSkill_employeeId_skillId_key" ON "EmployeeSkill"("employeeId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_name_key" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_name_key" ON "ProjectStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Priority_name_key" ON "Priority"("name");

-- CreateIndex
CREATE INDEX "Project_projectStatusId_idx" ON "Project"("projectStatusId");

-- CreateIndex
CREATE INDEX "Project_businessUnitId_idx" ON "Project"("businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceType_name_key" ON "ResourceType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCentre_code_key" ON "CostCentre"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_name_key" ON "Scenario"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastSource_name_key" ON "ForecastSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentStatus_name_key" ON "RecruitmentStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentType_name_key" ON "AdjustmentType"("name");

-- CreateIndex
CREATE INDEX "ForecastAllocation_scenarioId_dateKey_idx" ON "ForecastAllocation"("scenarioId", "dateKey");

-- CreateIndex
CREATE INDEX "ForecastAllocation_projectId_idx" ON "ForecastAllocation"("projectId");

-- CreateIndex
CREATE INDEX "ForecastAllocation_employeeId_idx" ON "ForecastAllocation"("employeeId");

-- CreateIndex
CREATE INDEX "ForecastAllocation_teamId_idx" ON "ForecastAllocation"("teamId");

-- CreateIndex
CREATE INDEX "ForecastAllocation_skillId_idx" ON "ForecastAllocation"("skillId");

-- CreateIndex
CREATE INDEX "ActualAllocation_employeeId_dateKey_idx" ON "ActualAllocation"("employeeId", "dateKey");

-- CreateIndex
CREATE INDEX "ActualAllocation_projectId_idx" ON "ActualAllocation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Capacity_teamId_scenarioId_dateKey_key" ON "Capacity"("teamId", "scenarioId", "dateKey");

-- CreateIndex
CREATE INDEX "Recruitment_teamId_idx" ON "Recruitment"("teamId");

-- CreateIndex
CREATE INDEX "Recruitment_recruitmentStatusId_idx" ON "Recruitment"("recruitmentStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_costCentreId_scenarioId_dateKey_costCategory_key" ON "Budget"("costCentreId", "scenarioId", "dateKey", "costCategory");

-- CreateIndex
CREATE UNIQUE INDEX "MeasureCatalog_name_key" ON "MeasureCatalog"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workingCalendarId_fkey" FOREIGN KEY ("workingCalendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "EmployeeStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_workingCalendarId_fkey" FOREIGN KEY ("workingCalendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicHoliday" ADD CONSTRAINT "PublicHoliday_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_skillCategoryId_fkey" FOREIGN KEY ("skillCategoryId") REFERENCES "SkillCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountManagerEmployeeId_fkey" FOREIGN KEY ("accountManagerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_programmeManagerEmployeeId_fkey" FOREIGN KEY ("programmeManagerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerEmployeeId_fkey" FOREIGN KEY ("projectManagerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "Priority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectStatusId_fkey" FOREIGN KEY ("projectStatusId") REFERENCES "ProjectStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCentre" ADD CONSTRAINT "CostCentre_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_baseScenarioId_fkey" FOREIGN KEY ("baseScenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_forecastSourceId_fkey" FOREIGN KEY ("forecastSourceId") REFERENCES "ForecastSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "CalendarDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualAllocation" ADD CONSTRAINT "ActualAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualAllocation" ADD CONSTRAINT "ActualAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualAllocation" ADD CONSTRAINT "ActualAllocation_forecastSourceId_fkey" FOREIGN KEY ("forecastSourceId") REFERENCES "ForecastSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualAllocation" ADD CONSTRAINT "ActualAllocation_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "CalendarDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualAllocation" ADD CONSTRAINT "ActualAllocation_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capacity" ADD CONSTRAINT "Capacity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capacity" ADD CONSTRAINT "Capacity_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capacity" ADD CONSTRAINT "Capacity_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "CalendarDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recruitment" ADD CONSTRAINT "Recruitment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recruitment" ADD CONSTRAINT "Recruitment_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recruitment" ADD CONSTRAINT "Recruitment_recruitmentStatusId_fkey" FOREIGN KEY ("recruitmentStatusId") REFERENCES "RecruitmentStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_dateKey_fkey" FOREIGN KEY ("dateKey") REFERENCES "CalendarDate"("dateKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAdjustment" ADD CONSTRAINT "ScenarioAdjustment_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAdjustment" ADD CONSTRAINT "ScenarioAdjustment_adjustmentTypeId_fkey" FOREIGN KEY ("adjustmentTypeId") REFERENCES "AdjustmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAdjustment" ADD CONSTRAINT "ScenarioAdjustment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAdjustment" ADD CONSTRAINT "ScenarioAdjustment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAdjustment" ADD CONSTRAINT "ScenarioAdjustment_effectiveDateKey_fkey" FOREIGN KEY ("effectiveDateKey") REFERENCES "CalendarDate"("dateKey") ON DELETE SET NULL ON UPDATE CASCADE;
