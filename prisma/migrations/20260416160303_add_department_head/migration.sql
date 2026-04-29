/*
  Warnings:

  - Made the column `departmentId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_departmentId_fkey";

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "headId" INTEGER;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "departmentId" SET NOT NULL;

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_departmentId_idx" ON "TimeEntry"("departmentId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
