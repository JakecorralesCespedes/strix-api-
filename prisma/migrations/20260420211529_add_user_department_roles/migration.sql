-- CreateTable
CREATE TABLE "UserDepartment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "UserDepartment_roleId_idx" ON "UserDepartment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartment_userId_departmentId_key" ON "UserDepartment"("userId", "departmentId");

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
