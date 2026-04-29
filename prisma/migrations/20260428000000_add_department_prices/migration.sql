-- AlterTable
ALTER TABLE "WorkHours" ADD COLUMN "priceId" INTEGER;

-- CreateTable
CREATE TABLE "DepartmentPrice" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentPrice_departmentId_idx" ON "DepartmentPrice"("departmentId");

-- AddForeignKey
ALTER TABLE "DepartmentPrice" ADD CONSTRAINT "DepartmentPrice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHours" ADD CONSTRAINT "WorkHours_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "DepartmentPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
