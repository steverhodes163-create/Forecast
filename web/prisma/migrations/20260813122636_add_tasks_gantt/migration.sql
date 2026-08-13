
-- AlterTable
ALTER TABLE "ForecastAllocation" ADD COLUMN     "taskId" INTEGER;

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "manualStartDate" DATE,
    "computedStartDate" DATE,
    "computedEndDate" DATE,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" SERIAL NOT NULL,
    "predecessorTaskId" INTEGER NOT NULL,
    "successorTaskId" INTEGER NOT NULL,
    "lagDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "fte" DECIMAL(4,3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_predecessorTaskId_successorTaskId_key" ON "TaskDependency"("predecessorTaskId", "successorTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_employeeId_key" ON "TaskAssignment"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "ForecastAllocation_taskId_idx" ON "ForecastAllocation"("taskId");

-- AddForeignKey
ALTER TABLE "ForecastAllocation" ADD CONSTRAINT "ForecastAllocation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_predecessorTaskId_fkey" FOREIGN KEY ("predecessorTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_successorTaskId_fkey" FOREIGN KEY ("successorTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

