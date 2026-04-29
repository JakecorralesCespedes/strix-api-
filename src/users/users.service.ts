import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../common/prisma.service';
import { FirebaseService } from '../common/fireabase.service';
import { MailerService } from '../common/mailer.service';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import { Prisma, User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  createPaginatedResponse,
  createPaginationMetadata,
  PaginatedResponse,
} from '../utils/pagination.util';
import { GetUsersDto } from './dto/get-users.dto';
import { RolesService } from '../roles/roles.service';

const DEFAULT_ROLE = 2;

export type UserWithRoleDepartment = Prisma.UserGetPayload<{
  include: {
    role: true;
    department: true;
    departmentRoles: { include: { role: true; department: true } };
  };
}>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly rolesService: RolesService,
    private readonly mailerService: MailerService,
  ) {}

  private normalizeDepartmentRoles(
    departmentRoles: CreateUserDto['departmentRoles'] | undefined,
    fallbackDepartmentId: number,
    fallbackRoleId: number,
  ): Array<{ departmentId: number; roleId: number }> {
    const roles = departmentRoles?.length
      ? departmentRoles
      : [{ departmentId: fallbackDepartmentId, roleId: fallbackRoleId }];

    const unique = new Map<number, number>();
    roles.forEach((item) => {
      if (item?.departmentId && item?.roleId) {
        unique.set(item.departmentId, item.roleId);
      }
    });

    if (!unique.size) {
      unique.set(fallbackDepartmentId, fallbackRoleId);
    }

    return Array.from(unique.entries()).map(([departmentId, roleId]) => ({
      departmentId,
      roleId,
    }));
  }

  private resolveActiveDepartmentId(
    activeDepartmentId: number | undefined,
    departmentRoles: Array<{ departmentId: number; roleId: number }>,
    fallbackDepartmentId: number,
  ): number {
    if (
      activeDepartmentId &&
      departmentRoles.some((item) => item.departmentId === activeDepartmentId)
    ) {
      return activeDepartmentId;
    }

    return departmentRoles[0]?.departmentId ?? fallbackDepartmentId;
  }

  private resolveActiveRoleId(
    activeDepartmentId: number,
    departmentRoles: Array<{ departmentId: number; roleId: number }>,
    fallbackRoleId: number,
  ): number {
    const match = departmentRoles.find(
      (item) => item.departmentId === activeDepartmentId,
    );
    return match?.roleId ?? fallbackRoleId;
  }

  private async validateDepartmentRoles(
    departmentRoles: Array<{ departmentId: number; roleId: number }>,
  ) {
    const departmentIds = Array.from(
      new Set(departmentRoles.map((item) => item.departmentId)),
    );
    const roleIds = Array.from(
      new Set(departmentRoles.map((item) => item.roleId)),
    );

    const [departments, roles] = await Promise.all([
      this.prismaService.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true },
      }),
      this.prismaService.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true },
      }),
    ]);

    if (departments.length !== departmentIds.length) {
      throw new BadRequestException('One or more departments do not exist');
    }

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }
  }

  createUserInput(
    createUserDto: CreateUserDto,
    firebaseUser: UserRecord,
    departmentRoles: Array<{ departmentId: number; roleId: number }>,
    activeDepartmentId: number,
    activeRoleId: number,
  ): Prisma.UserCreateInput {
    return {
      email: createUserDto.email,
      name: createUserDto.name,
      phone: createUserDto.phone,
      uuid: firebaseUser.uid,
      department: {
        connect: { id: activeDepartmentId },
      },
      role: {
        connect: { id: activeRoleId },
      },
      departmentRoles: {
        create: departmentRoles.map((item) => ({
          departmentId: item.departmentId,
          roleId: item.roleId,
        })),
      },
    };
  }

  createUpdateUserInput(updateUser: UpdateUserDto): Prisma.UserUpdateInput {
    const {
      password,
      departmentRoles,
      activeDepartmentId,
      roleId,
      departmentId,
      ...rest
    } = updateUser as UpdateUserDto & {
      password?: string;
      departmentRoles?: CreateUserDto['departmentRoles'];
      activeDepartmentId?: number;
      roleId?: number;
      departmentId?: number;
    };

    return { ...rest };
  }
  // crear susuario
  async create(createUserDto: CreateUserDto) {
    if (await this.exists(createUserDto.email)) {
      throw new BadRequestException('User already exists');
    }

    const fallbackDepartmentId = createUserDto.departmentId ?? 1;
    const fallbackRoleId = createUserDto.roleId ?? DEFAULT_ROLE;
    const departmentRoles = this.normalizeDepartmentRoles(
      createUserDto.departmentRoles,
      fallbackDepartmentId,
      fallbackRoleId,
    );
    await this.validateDepartmentRoles(departmentRoles);

    const activeDepartmentId = this.resolveActiveDepartmentId(
      createUserDto.activeDepartmentId ?? createUserDto.departmentId,
      departmentRoles,
      fallbackDepartmentId,
    );
    const activeRoleId = this.resolveActiveRoleId(
      activeDepartmentId,
      departmentRoles,
      fallbackRoleId,
    );

    const role = await this.rolesService.findOne(activeRoleId);

    if (!role) {
      throw new BadRequestException(
        `Role with id ${activeRoleId} does not exist`,
      );
    }

    const firebaseUser = await this.firebaseService.createUser({
      email: createUserDto.email,
      password: createUserDto.password,
    });

    await this.firebaseService.addCustomClaims(firebaseUser.uid, {
      allowedPermissions: role.allowedPermissions,
      roleId: role.id,
    });

    const user = await this.prismaService.user.create({
      data: this.createUserInput(
        createUserDto,
        firebaseUser,
        departmentRoles,
        activeDepartmentId,
        activeRoleId,
      ),
      include: {
        role: true,
        department: true,
      },
    });

    try {
      await this.mailerService.sendWelcomeUser({
        name: user.name,
        email: user.email,
        password: createUserDto.password,
        roleName: user.role?.name ?? role.name,
        departmentName: user.department?.name ?? '',
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el correo de bienvenida a ${user.email}: ${error?.message ?? error}`,
      );
    }

    return user;
  }
  // fin

  async createFromFirebase(
    firebaseUser: { uid: string; email?: string | null; name?: string | null },
    roleId: number,
  ): Promise<UserWithRoleDepartment> {
    const email = firebaseUser.email || 'unknown@local';
    const existingByEmail = await this.prismaService.user.findFirst({
      where: { email },
      include: {
        role: true,
        department: true,
        departmentRoles: { include: { role: true, department: true } },
      },
    });

    if (existingByEmail) {
      return existingByEmail;
    }

    const role = await this.rolesService.findOne(roleId);

    if (!role) {
      throw new BadRequestException(`Role with id ${roleId} does not exist`);
    }

    const department = await this.prismaService.department.findFirst();

    if (!department) {
      throw new BadRequestException('No departments available');
    }

    await this.firebaseService.addCustomClaims(firebaseUser.uid, {
      allowedPermissions: role.allowedPermissions,
      roleId: role.id,
    });

    return this.prismaService.user.create({
      data: {
        email,
        name: firebaseUser.name || email.split('@')[0] || 'New User',
        phone: '',
        uuid: firebaseUser.uid,
        role: { connect: { id: role.id } },
        department: { connect: { id: department.id } },
        departmentRoles: {
          create: [{ departmentId: department.id, roleId: role.id }],
        },
      },
      include: {
        role: true,
        department: true,
        departmentRoles: { include: { role: true, department: true } },
      },
    });
  }

  async findAll(query: GetUsersDto): Promise<PaginatedResponse<User>> {
    const { page = 1, size = 10, search } = query;

    const { take, skip } = createPaginationMetadata(page, size);

    const prismaQuery: Prisma.UserFindManyArgs = {
      take,
      skip,
      include: {
        role: true,
        department: true,
        departmentRoles: { include: { role: true, department: true } },
      },
      where: {},
    };

    if (search) {
      prismaQuery.where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive', // Búsqueda insensible a mayúsculas/minúsculas
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive', // Búsqueda insensible a mayúsculas/minúsculas
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      this.prismaService.user.findMany(prismaQuery),
      this.prismaService.user.count({ where: prismaQuery.where }),
    ]);

    return createPaginatedResponse<User>(users, total, page, size);
  }

  private async exists(email: string): Promise<boolean> {
    try {
      const user = await this.prismaService.user.findFirst({
        where: {
          email,
        },
      });

      return !!user;
    } catch (error) {
      return false;
    }
  }
  findOne(identifier: string): Promise<UserWithRoleDepartment | null> {
    const maybeId = Number(identifier);
    const isNumericId = Number.isInteger(maybeId) && `${maybeId}` === identifier;

    return this.prismaService.user.findFirst({
      where: {
        ...(isNumericId ? { id: maybeId } : { uuid: identifier }),
      },
      include: {
        role: true,
        department: true,
        departmentRoles: { include: { role: true, department: true } },
      },
    });
  }

  async update(identifier: string, updateUserDto: UpdateUserDto): Promise<User> {
    // return `This action updates a #${id} user`;
    //update firebase

    const maybeId = Number(identifier);
    const isNumericId = Number.isInteger(maybeId) && `${maybeId}` === identifier;
    const existingUser = await this.prismaService.user.findFirst({
      where: {
        ...(isNumericId ? { id: maybeId } : { uuid: identifier }),
      },
      include: {
        role: true,
        department: true,
        departmentRoles: { include: { role: true, department: true } },
      },
    });

    if (!existingUser) {
      throw new BadRequestException('User not found');
    }

    if (updateUserDto.email || updateUserDto.password) {
      await this.firebaseService.updateUser(existingUser.uuid, {
        password: updateUserDto.password,
        email: updateUserDto.email,
      });
    }
    const updateAssignments = updateUserDto.departmentRoles?.length
      ? this.normalizeDepartmentRoles(
          updateUserDto.departmentRoles,
          updateUserDto.departmentId ?? existingUser.departmentId,
          updateUserDto.roleId ?? existingUser.roleId,
        )
      : null;

    if (updateAssignments) {
      await this.validateDepartmentRoles(updateAssignments);
    }

    let activeDepartmentId =
      updateUserDto.activeDepartmentId ??
      updateUserDto.departmentId ??
      existingUser.departmentId;
    let activeRoleId = updateUserDto.roleId ?? existingUser.roleId;

    if (updateAssignments?.length) {
      activeDepartmentId = this.resolveActiveDepartmentId(
        updateUserDto.activeDepartmentId ?? updateUserDto.departmentId,
        updateAssignments,
        existingUser.departmentId,
      );
      activeRoleId = this.resolveActiveRoleId(
        activeDepartmentId,
        updateAssignments,
        activeRoleId,
      );
    } else if (updateUserDto.activeDepartmentId) {
      const match = existingUser.departmentRoles?.find(
        (item) => item.departmentId === updateUserDto.activeDepartmentId,
      );
      if (match) {
        activeRoleId = match.roleId;
      }
    }

    if (activeRoleId !== existingUser.roleId) {
      const activeRole = await this.rolesService.findOne(activeRoleId);
      if (activeRole) {
        await this.firebaseService.addCustomClaims(existingUser.uuid, {
          allowedPermissions: activeRole.allowedPermissions,
          roleId: activeRole.id,
        });
      }
    }

    const user = await this.prismaService.$transaction(async (tx) => {
      if (updateAssignments?.length) {
        await tx.userDepartment.deleteMany({
          where: { userId: existingUser.id },
        });

        await tx.userDepartment.createMany({
          data: updateAssignments.map((item) => ({
            userId: existingUser.id,
            departmentId: item.departmentId,
            roleId: item.roleId,
          })),
        });
      } else if (
        updateUserDto.departmentId &&
        updateUserDto.roleId &&
        !updateUserDto.departmentRoles?.length
      ) {
        await tx.userDepartment.upsert({
          where: {
            userId_departmentId: {
              userId: existingUser.id,
              departmentId: updateUserDto.departmentId,
            },
          },
          update: { roleId: updateUserDto.roleId },
          create: {
            userId: existingUser.id,
            departmentId: updateUserDto.departmentId,
            roleId: updateUserDto.roleId,
          },
        });
      }

      const data = this.createUpdateUserInput(updateUserDto);
      data.department = { connect: { id: activeDepartmentId } };
      data.role = { connect: { id: activeRoleId } };

      return tx.user.update({
        where: { uuid: existingUser.uuid },
        data,
        include: {
          role: true,
          department: true,
          departmentRoles: { include: { role: true, department: true } },
        },
      });
    });

    return user;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
