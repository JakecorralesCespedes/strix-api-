import { PeriodStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PriceItem = {
  id: number;
  price: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

async function ensureRole(name: string, allowedPermissions: string[]) {
  const existing = await prisma.role.findFirst({ where: { name } });
  if (existing) {
    return existing;
  }

  return prisma.role.create({
    data: {
      name,
      allowedPermissions,
    },
  });
}

async function ensureDepartment(name: string, code: string, pricing: number) {
  const existing = await prisma.department.findFirst({ where: { code } });
  if (existing) {
    return existing;
  }

  return prisma.department.create({
    data: {
      name,
      code,
      pricing,
    },
  });
}

async function ensureUser(params: {
  uuid: string;
  name: string;
  email: string;
  phone: string;
  roleId: number;
  departmentId: number;
}) {
  const existing = await prisma.user.findUnique({ where: { uuid: params.uuid } });
  if (existing) {
    return prisma.user.update({
      where: { uuid: params.uuid },
      data: {
        name: params.name,
        email: params.email,
        phone: params.phone,
        roleId: params.roleId,
        departmentId: params.departmentId,
      },
    });
  }

  const { uuid, name, email, phone, roleId, departmentId } = params;
  return prisma.user.create({
    data: {
      uuid,
      name,
      email,
      phone,
      roleId,
      departmentId,
    },
  });
}

async function ensureMailing(name: string, email: string, active = true) {
  const existing = await prisma.mailingList.findFirst({ where: { email } });
  if (existing) {
    return prisma.mailingList.update({
      where: { id: existing.id },
      data: { name, active },
    });
  }

  return prisma.mailingList.create({
    data: { name, email, active },
  });
}

async function ensurePeriod(name: string, start: Date, end: Date, status: PeriodStatus) {
  const existing = await prisma.period.findFirst({ where: { name } });
  if (existing) {
    return prisma.period.update({
      where: { id: existing.id },
      data: { start, end, status },
    });
  }

  return prisma.period.create({
    data: { name, start, end, status },
  });
}

async function ensureStudent(name: string, email: string, phone: string, code: string) {
  const existing = await prisma.student.findFirst({ where: { code } });
  if (existing) {
    return prisma.student.update({
      where: { id: existing.id },
      data: { name, email, phone },
    });
  }

  return prisma.student.create({
    data: { name, email, phone, code },
  });
}

async function ensureStudentDepartment(studentId: number, departmentId: number) {
  const existing = await prisma.studentOnDepartment.findFirst({
    where: { studentId, departmentId },
  });

  if (existing) {
    return existing;
  }

  return prisma.studentOnDepartment.create({
    data: { studentId, departmentId },
  });
}

async function upsertConfig(key: string, value: string) {
  await prisma.globalSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function main() {
  const now = new Date();

  const adminRole = await ensureRole('Admin', [
    'users.read',
    'users.write',
    'departments.read',
    'departments.write',
    'periods.read',
    'periods.write',
    'configs.read',
    'configs.write',
  ]);

  const operatorRole = await ensureRole('Operator', [
    'users.read',
    'departments.read',
    'periods.read',
    'configs.read',
  ]);

  const supportRole = await ensureRole('Support', [
    'users.read',
    'departments.read',
  ]);

  const priceList: PriceItem[] = [
    {
      id: 1,
      price: 80,
      active: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 2,
      price: 120,
      active: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  await upsertConfig('defaultPrice', '80');
  await upsertConfig('studentsCode', 'EST-');
  await upsertConfig('scolarshipCode', 'BEC-');
  await upsertConfig('tithCode', 'DT-');
  await upsertConfig('prices', JSON.stringify(priceList));

  const devDepartment = await ensureDepartment('Desarrollo', 'DEV', 120);
  const opsDepartment = await ensureDepartment('Operaciones', 'OPS', 80);
  const supportDepartment = await ensureDepartment('Soporte', 'SUP', 80);

  await ensurePeriod(
    'Periodo 2026-1',
    new Date('2026-01-01T00:00:00.000Z'),
    new Date('2026-06-30T23:59:59.999Z'),
    PeriodStatus.ACTIVE,
  );

  await ensurePeriod(
    'Periodo 2026-2',
    new Date('2026-07-01T00:00:00.000Z'),
    new Date('2026-12-31T23:59:59.999Z'),
    PeriodStatus.PENDING,
  );

  await ensureMailing('Admin Strix', 'admin@strix.local', true);
  await ensureMailing('Soporte Strix', 'soporte@strix.local', true);
  await ensureMailing('Notificaciones', 'notificaciones@strix.local', true);

  const adminUser = await ensureUser({
    uuid: 'seed-admin-uuid',
    name: 'Admin Demo',
    email: 'admin@strix.local',
    phone: '809-000-0001',
    roleId: adminRole.id,
    departmentId: devDepartment.id,
  });

  await ensureUser({
    uuid: 'seed-operator-uuid',
    name: 'Operador Demo',
    email: 'operator@strix.local',
    phone: '809-000-0002',
    roleId: operatorRole.id,
    departmentId: opsDepartment.id,
  });

  await ensureUser({
    uuid: 'seed-support-uuid',
    name: 'Soporte Demo',
    email: 'support@strix.local',
    phone: '809-000-0003',
    roleId: supportRole.id,
    departmentId: supportDepartment.id,
  });

  const studentOne = await ensureStudent(
    'Juan Perez',
    'juan.perez@strix.local',
    '809-100-0001',
    'EST-0001',
  );

  const studentTwo = await ensureStudent(
    'Maria Gomez',
    'maria.gomez@strix.local',
    '809-100-0002',
    'EST-0002',
  );

  await ensureStudentDepartment(studentOne.id, devDepartment.id);
  await ensureStudentDepartment(studentTwo.id, opsDepartment.id);

  console.log('Seed completed');
  console.log(`Roles: ${adminRole.id}, ${operatorRole.id}, ${supportRole.id}`);
  console.log(`Departments: ${devDepartment.id}, ${opsDepartment.id}, ${supportDepartment.id}`);
  console.log(`Users: ${adminUser.email} and test users created/updated`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
