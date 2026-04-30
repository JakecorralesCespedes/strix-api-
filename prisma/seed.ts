import { PeriodStatus, PrismaClient, RequestStatus, WorkHoursStatus } from '@prisma/client';
import { config } from 'dotenv';
import * as admin from 'firebase-admin';
import { getCredentialsFromEnv } from '../src/utils';

config();

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'jakecorrales24@gmail.com';

const ADMIN_PERMISSIONS = [
  'users.read',
  'users.write',
  'students.read',
  'students.write',
  'departments.read',
  'departments.write',
  'periods.read',
  'periods.write',
  'periods.reopen',
  'configs.read',
  'configs.write',
  'roles.read',
  'roles.write',
  'permissions.read',
  'permissions.write',
  'pricing.read',
  'pricing.write',
  'scholarship.read',
  'scholarship.write',
  'work-hours.read',
  'work-hours.write',
  'work-hours.approve',
  'work-hours.financials.read',
  'work-hours.apply',
  'work-hours.edit-approved',
  'reports.read',
];

const DEPARTMENT_HEAD_PERMISSIONS = [
  'departments.read',
  'students.read',
  'students.write',
  'scholarship.read',
  'scholarship.write',
  'periods.read',
  'pricing.read',
  'pricing.write',
  'work-hours.read',
  'work-hours.write',
  'work-hours.approve',
  'work-hours.financials.read',
  'work-hours.apply',
  'reports.read',
];

const DEPARTMENT_ASSISTANT_PERMISSIONS = [
  'departments.read',
  'students.read',
  'scholarship.read',
  'periods.read',
  'work-hours.read',
  'work-hours.write',
  'work-hours.apply',
];

const OPERATOR_PERMISSIONS = [
  'users.read',
  'students.read',
  'students.write',
  'departments.read',
  'periods.read',
  'configs.read',
  'scholarship.read',
  'work-hours.read',
  'work-hours.financials.read',
  'reports.read',
];

const SUPPORT_PERMISSIONS = [
  'users.read',
  'departments.read',
  'scholarship.read',
  'work-hours.read',
];

async function findExistingAdmin() {
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
  });
  return admin;
}

async function cleanDatabase() {
  console.log('Limpiando base de datos...');
  await prisma.workHours.deleteMany();
  await prisma.scholarshipPayroll.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.studentOnDepartment.deleteMany();
  await prisma.userDepartment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.department.updateMany({ data: { headId: null } });
  await prisma.user.deleteMany();
  await prisma.departmentPrice.deleteMany();
  await prisma.department.deleteMany();
  await prisma.role.deleteMany();
  await prisma.period.deleteMany();
  // No borramos globalSetting para mantener configuración de PDF/notifs si existe.
  console.log('Base de datos limpia.');
}

function ensureFirebaseInit() {
  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    return false;
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(credentials as admin.ServiceAccount),
    });
  }
  return true;
}

async function refreshFirebaseClaims(uuid: string, allowedPermissions: string[], roleId: number) {
  if (!ensureFirebaseInit()) {
    console.warn('Sin credenciales Firebase. Omitiendo actualización de claims.');
    return;
  }
  try {
    await admin.auth().setCustomUserClaims(uuid, {
      allowedPermissions,
      roleId,
    });
  } catch (error: any) {
    console.warn(`No se pudieron actualizar claims para ${uuid}: ${error?.message ?? error}`);
  }
}

async function ensureFirebaseUser(params: {
  email: string;
  password: string;
  name: string;
}): Promise<string | null> {
  if (!ensureFirebaseInit()) {
    return null;
  }
  try {
    const existing = await admin.auth().getUserByEmail(params.email);
    return existing.uid;
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') {
      console.warn(`Error consultando usuario ${params.email}: ${error?.message ?? error}`);
      return null;
    }
  }

  try {
    const created = await admin.auth().createUser({
      email: params.email,
      password: params.password,
      displayName: params.name,
    });
    return created.uid;
  } catch (error: any) {
    console.warn(`No se pudo crear ${params.email}: ${error?.message ?? error}`);
    return null;
  }
}

async function main() {
  const existingAdmin = await findExistingAdmin();

  if (!existingAdmin) {
    console.warn(
      `No se encontró un usuario con correo ${ADMIN_EMAIL}. Si es la primera vez, créalo manualmente desde Firebase y vuelve a correr el seed.`,
    );
  }

  const adminUuid = existingAdmin?.uuid;
  const adminName = existingAdmin?.name ?? 'Administrador';
  const adminPhone = existingAdmin?.phone ?? '';

  await cleanDatabase();

  console.log('Creando roles...');
  const adminRole = await prisma.role.create({
    data: { name: 'Admin', allowedPermissions: ADMIN_PERMISSIONS },
  });
  const departmentHeadRole = await prisma.role.create({
    data: { name: 'Jefe de Departamento', allowedPermissions: DEPARTMENT_HEAD_PERMISSIONS },
  });
  const assistantRole = await prisma.role.create({
    data: { name: 'Asistente de Departamento', allowedPermissions: DEPARTMENT_ASSISTANT_PERMISSIONS },
  });
  const operatorRole = await prisma.role.create({
    data: { name: 'Operador', allowedPermissions: OPERATOR_PERMISSIONS },
  });
  const supportRole = await prisma.role.create({
    data: { name: 'Soporte', allowedPermissions: SUPPORT_PERMISSIONS },
  });

  console.log('Creando departamentos...');
  const desarrollo = await prisma.department.create({
    data: { name: 'Desarrollo', code: 'DEV', pricing: 1500 },
  });
  const operaciones = await prisma.department.create({
    data: { name: 'Operaciones', code: 'OPS', pricing: 1200 },
  });
  const biblioteca = await prisma.department.create({
    data: { name: 'Biblioteca', code: 'BIB', pricing: 1000 },
  });
  const soporte = await prisma.department.create({
    data: { name: 'Soporte', code: 'SUP', pricing: 1100 },
  });

  console.log('Creando precios por departamento...');
  await prisma.departmentPrice.createMany({
    data: [
      { departmentId: desarrollo.id, label: 'Desarrollador junior', price: 1500, active: true },
      { departmentId: desarrollo.id, label: 'Desarrollador avanzado', price: 2000, active: true },
      { departmentId: desarrollo.id, label: 'Líder técnico', price: 2500, active: true },
      { departmentId: operaciones.id, label: 'Auxiliar', price: 1000, active: true },
      { departmentId: operaciones.id, label: 'Coordinador', price: 1300, active: true },
      { departmentId: biblioteca.id, label: 'Tarifa estándar', price: 1000, active: true },
      { departmentId: biblioteca.id, label: 'Tarifa nocturna', price: 1200, active: true },
      { departmentId: soporte.id, label: 'Tarifa estándar', price: 1100, active: true },
    ],
  });

  console.log('Creando periodos...');
  const periodoActivo = await prisma.period.create({
    data: {
      name: 'Periodo 2026-1',
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-06-30T23:59:59.999Z'),
      status: PeriodStatus.ACTIVE,
    },
  });
  await prisma.period.create({
    data: {
      name: 'Periodo 2026-2',
      start: new Date('2026-07-01T00:00:00.000Z'),
      end: new Date('2026-12-31T23:59:59.999Z'),
      status: PeriodStatus.PENDING,
    },
  });
  await prisma.period.create({
    data: {
      name: 'Periodo 2025-2',
      start: new Date('2025-07-01T00:00:00.000Z'),
      end: new Date('2025-12-31T23:59:59.999Z'),
      status: PeriodStatus.FINISHED,
    },
  });

  console.log('Creando configuración global...');
  const settings = [
    { key: 'defaultPrice', value: '1200' },
    { key: 'studentsCode', value: 'EST-' },
    { key: 'scolarshipCode', value: 'BEC-' },
    { key: 'tithCode', value: 'DT-' },
    { key: 'notify.user.welcome', value: 'true' },
    { key: 'notify.user.passwordReset', value: 'true' },
    { key: 'notify.scholarship.approved', value: 'true' },
    { key: 'notify.scholarship.rejected', value: 'true' },
    { key: 'notify.workHours.approved', value: 'true' },
  ];
  for (const setting of settings) {
    await prisma.globalSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  if (adminUuid) {
    console.log('Recreando admin...');
    const adminUser = await prisma.user.create({
      data: {
        uuid: adminUuid,
        name: adminName,
        email: ADMIN_EMAIL,
        phone: adminPhone,
        roleId: adminRole.id,
        departmentId: desarrollo.id,
        departmentRoles: {
          create: [
            { departmentId: desarrollo.id, roleId: adminRole.id },
            { departmentId: operaciones.id, roleId: adminRole.id },
            { departmentId: biblioteca.id, roleId: adminRole.id },
            { departmentId: soporte.id, roleId: adminRole.id },
          ],
        },
      },
    });
    await refreshFirebaseClaims(adminUuid, ADMIN_PERMISSIONS, adminRole.id);
    console.log(`Admin recreado: ${adminUser.email}`);
  }

  console.log('Creando usuarios de prueba...');
  const TEST_PASSWORD = process.env.SEED_USER_PASSWORD || 'Strix2026!';

  const testUserDefs = [
    {
      email: 'jefe.dev@strix.local',
      name: 'Jefe Desarrollo',
      phone: '+506 8100-0001',
      role: departmentHeadRole,
      departments: [desarrollo],
    },
    {
      email: 'jefe.ops@strix.local',
      name: 'Jefe Operaciones',
      phone: '+506 8100-0002',
      role: departmentHeadRole,
      departments: [operaciones],
    },
    {
      email: 'asistente.dev@strix.local',
      name: 'Asistente Desarrollo',
      phone: '+506 8100-0003',
      role: assistantRole,
      departments: [desarrollo],
    },
    {
      email: 'operador@strix.local',
      name: 'Operador General',
      phone: '+506 8100-0004',
      role: operatorRole,
      departments: [desarrollo, operaciones, biblioteca, soporte],
    },
  ];

  const createdTestUsers: Array<{ email: string; userId: number }> = [];

  for (const def of testUserDefs) {
    const uuid = await ensureFirebaseUser({
      email: def.email,
      password: TEST_PASSWORD,
      name: def.name,
    });

    if (!uuid) {
      console.warn(
        `Saltando usuario de prueba ${def.email} porque Firebase no está disponible.`,
      );
      continue;
    }

    const created = await prisma.user.create({
      data: {
        uuid,
        name: def.name,
        email: def.email,
        phone: def.phone,
        roleId: def.role.id,
        departmentId: def.departments[0].id,
        departmentRoles: {
          create: def.departments.map((department) => ({
            departmentId: department.id,
            roleId: def.role.id,
          })),
        },
      },
    });

    await refreshFirebaseClaims(uuid, def.role.allowedPermissions, def.role.id);
    createdTestUsers.push({ email: def.email, userId: created.id });
  }

  console.log(`Usuarios de prueba creados (contraseña: ${TEST_PASSWORD}):`);
  for (const u of createdTestUsers) {
    console.log(` - ${u.email}`);
  }

  // Asignar el primer jefe creado como head de Desarrollo
  const jefeDev = createdTestUsers.find((u) => u.email === 'jefe.dev@strix.local');
  if (jefeDev) {
    await prisma.department.update({
      where: { id: desarrollo.id },
      data: { headId: jefeDev.userId },
    });
  }
  const jefeOps = createdTestUsers.find((u) => u.email === 'jefe.ops@strix.local');
  if (jefeOps) {
    await prisma.department.update({
      where: { id: operaciones.id },
      data: { headId: jefeOps.userId },
    });
  }

  console.log('Creando estudiantes de prueba...');
  const estudiantes = await Promise.all([
    prisma.student.create({
      data: {
        name: 'Juan Pérez',
        email: 'juan.perez@universidad.edu',
        phone: '+506 8000-0001',
        code: 'EST-2026-0001',
      },
    }),
    prisma.student.create({
      data: {
        name: 'María Gómez',
        email: 'maria.gomez@universidad.edu',
        phone: '+506 8000-0002',
        code: 'EST-2026-0002',
      },
    }),
    prisma.student.create({
      data: {
        name: 'Carlos Rojas',
        email: 'carlos.rojas@universidad.edu',
        phone: '+506 8000-0003',
        code: 'EST-2026-0003',
      },
    }),
    prisma.student.create({
      data: {
        name: 'Ana Vargas',
        email: 'ana.vargas@universidad.edu',
        phone: '+506 8000-0004',
        code: 'EST-2026-0004',
      },
    }),
    prisma.student.create({
      data: {
        name: 'Luis Morales',
        email: 'luis.morales@universidad.edu',
        phone: '+506 8000-0005',
        code: 'EST-2026-0005',
      },
    }),
    prisma.student.create({
      data: {
        name: 'Sofía Castillo',
        email: 'sofia.castillo@universidad.edu',
        phone: '+506 8000-0006',
        code: 'EST-2026-0006',
      },
    }),
  ]);

  console.log('Asignando estudiantes a departamentos...');
  await prisma.studentOnDepartment.createMany({
    data: [
      { studentId: estudiantes[0].id, departmentId: desarrollo.id, status: RequestStatus.APPROVED },
      { studentId: estudiantes[1].id, departmentId: desarrollo.id, status: RequestStatus.APPROVED },
      { studentId: estudiantes[2].id, departmentId: operaciones.id, status: RequestStatus.APPROVED },
      { studentId: estudiantes[3].id, departmentId: biblioteca.id, status: RequestStatus.PENDING },
      { studentId: estudiantes[4].id, departmentId: biblioteca.id, status: RequestStatus.APPROVED },
      { studentId: estudiantes[5].id, departmentId: soporte.id, status: RequestStatus.PENDING },
    ],
  });

  if (adminUuid) {
    console.log('Creando registros de horas de prueba...');
    const adminUser = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
    if (adminUser) {
      const devPrices = await prisma.departmentPrice.findMany({
        where: { departmentId: desarrollo.id, active: true },
        orderBy: { id: 'asc' },
      });
      const opsPrices = await prisma.departmentPrice.findMany({
        where: { departmentId: operaciones.id, active: true },
        orderBy: { id: 'asc' },
      });

      const baseDate = new Date('2026-03-01T08:00:00.000Z');
      const oneHour = 60 * 60 * 1000;

      // Hora aprobada para Juan en Desarrollo
      const startA = new Date(baseDate);
      const endA = new Date(baseDate.getTime() + 4 * oneHour);
      await prisma.workHours.create({
        data: {
          name: 'Sesión de tutoría',
          start: startA,
          end: endA,
          amount: 4,
          price: devPrices[0]?.price ?? desarrollo.pricing,
          total: 4 * (devPrices[0]?.price ?? desarrollo.pricing),
          status: WorkHoursStatus.APPROVED,
          isAdditional: false,
          registedBy: adminUser.id,
          studentId: estudiantes[0].id,
          departmentId: desarrollo.id,
          priceId: devPrices[0]?.id ?? null,
          periodId: periodoActivo.id,
        },
      });

      // Hora pendiente para María en Desarrollo
      const startB = new Date(baseDate.getTime() + 24 * oneHour);
      const endB = new Date(startB.getTime() + 3 * oneHour);
      await prisma.workHours.create({
        data: {
          name: 'Laboratorio',
          start: startB,
          end: endB,
          amount: 3,
          price: devPrices[1]?.price ?? desarrollo.pricing,
          total: 3 * (devPrices[1]?.price ?? desarrollo.pricing),
          status: WorkHoursStatus.PENDING,
          isAdditional: false,
          registedBy: adminUser.id,
          studentId: estudiantes[1].id,
          departmentId: desarrollo.id,
          priceId: devPrices[1]?.id ?? null,
          periodId: periodoActivo.id,
        },
      });

      // Hora aprobada para Carlos en Operaciones
      const startC = new Date(baseDate.getTime() + 48 * oneHour);
      const endC = new Date(startC.getTime() + 5 * oneHour);
      await prisma.workHours.create({
        data: {
          name: 'Inventario',
          start: startC,
          end: endC,
          amount: 5,
          price: opsPrices[0]?.price ?? operaciones.pricing,
          total: 5 * (opsPrices[0]?.price ?? operaciones.pricing),
          status: WorkHoursStatus.APPROVED,
          isAdditional: false,
          registedBy: adminUser.id,
          studentId: estudiantes[2].id,
          departmentId: operaciones.id,
          priceId: opsPrices[0]?.id ?? null,
          periodId: periodoActivo.id,
        },
      });

      // Hora rechazada para Carlos
      const startD = new Date(baseDate.getTime() + 72 * oneHour);
      const endD = new Date(startD.getTime() + 2 * oneHour);
      await prisma.workHours.create({
        data: {
          name: 'Limpieza',
          start: startD,
          end: endD,
          amount: 2,
          price: opsPrices[1]?.price ?? operaciones.pricing,
          total: 2 * (opsPrices[1]?.price ?? operaciones.pricing),
          status: WorkHoursStatus.REJECTED,
          isAdditional: false,
          registedBy: adminUser.id,
          studentId: estudiantes[2].id,
          departmentId: operaciones.id,
          priceId: opsPrices[1]?.id ?? null,
          periodId: periodoActivo.id,
        },
      });
    }
  }

  console.log('Seed completado.');
  console.log(`Roles: Admin=${adminRole.id}, Jefe=${departmentHeadRole.id}, Asistente=${assistantRole.id}, Operador=${operatorRole.id}, Soporte=${supportRole.id}`);
  console.log(
    `Departamentos: Desarrollo=${desarrollo.id}, Operaciones=${operaciones.id}, Biblioteca=${biblioteca.id}, Soporte=${soporte.id}`,
  );
}

main()
  .catch((error) => {
    console.error('El seed falló:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
