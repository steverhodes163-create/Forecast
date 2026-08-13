
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "ownerTeamId" INTEGER;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

