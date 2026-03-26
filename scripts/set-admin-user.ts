import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('[START] Configurando jakecorrales24@gmail.com como Admin...');

    // Get the Admin role
    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!adminRole) {
      console.error('[ERROR] Admin role no existe. Ejecuta npm run seed primero');
      process.exit(1);
    }

    // Get the Development department
    const devDepartment = await prisma.department.findFirst({ where: { code: 'DEV' } });
    if (!devDepartment) {
      console.error('[ERROR] Development department no existe. Ejecuta npm run seed primero');
      process.exit(1);
    }

    // Try to find or create the user by email
    let user = await prisma.user.findFirst({
      where: { email: 'jakecorrales24@gmail.com' },
      include: { role: true, department: true },
    });

    if (user) {
      // Update existing user to Admin role
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          roleId: adminRole.id,
          departmentId: devDepartment.id,
        },
        include: { role: true, department: true },
      });
      console.log('[UPDATED] Usuario existente ahora es Admin:');
      console.log(`  Email: ${user.email}`);
      console.log(`  Nombre: ${user.name}`);
      console.log(`  Rol: ${user.role.name}`);
      console.log(`  Departamento: ${user.department.name}`);
    } else {
      console.log('[INFO] Usuario no encontrado en BD');
      console.log('[ACTION] Cuando el usuario inicie sesión en Firebase,');
      console.log('        se creará automáticamente con rol Admin.');
      console.log('        Email: jakecorrales24@gmail.com');
    }

    console.log('[SUCCESS] Configuración completada');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR]', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
