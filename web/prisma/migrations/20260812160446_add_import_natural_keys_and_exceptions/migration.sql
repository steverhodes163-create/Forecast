-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "employeeNumber" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectCode" TEXT;

-- CreateTable
CREATE TABLE "ImportException" (
    "id" SERIAL NOT NULL,
    "importBatchId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- AddForeignKey
ALTER TABLE "ImportException" ADD CONSTRAINT "ImportException_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

