import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../common/prisma.service';
import { FirebaseService } from '../common/fireabase.service';
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

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly rolesService: RolesService,
  ) {}

  createUserInput(
    createUserDto: CreateUserDto,
    firebaseUser: UserRecord,
  ): Prisma.UserCreateInput {
    const departmentId = createUserDto.departmentId ?? 1; // Default to first department
    
    const input: Prisma.UserCreateInput = {
      email: createUserDto.email,
      name: createUserDto.name,
      phone: createUserDto.phone,
      uuid: firebaseUser.uid,
      department: {
        connect: { id: departmentId },
      },
      role: {
        connect: { id: DEFAULT_ROLE },
      },
    };

    if (createUserDto.roleId) {
      input.role = {
        connect: { id: createUserDto.roleId },
      };
    }

    return input;
  }

  createUpdateUserInput(updateUser: UpdateUserDto): Prisma.UserUpdateInput {
    const input: Prisma.UserUpdateInput = {
      ...updateUser,
    };
    return input;
  }
  // crear susuario
  async create(createUserDto: CreateUserDto) {
    if (await this.exists(createUserDto.email)) {
      throw new BadRequestException('User already exists');
    }

    const roleId = createUserDto.roleId ?? DEFAULT_ROLE;
    const role = await this.rolesService.findOne(roleId);

    if (!role) {
      throw new BadRequestException(`Role with id ${roleId} does not exist`);
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
      data: this.createUserInput(createUserDto, firebaseUser),
    });

    return user;
  }
  // fin

  async findAll(query: GetUsersDto): Promise<PaginatedResponse<User>> {
    const { page = 1, size = 10, search } = query;

    const { take, skip } = createPaginationMetadata(page, size);

    const prismaQuery: Prisma.UserFindManyArgs = {
      take,
      skip,
      include: {
        role: true,
        department: true,
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
  findOne(identifier: string) {
    const maybeId = Number(identifier);
    const isNumericId = Number.isInteger(maybeId) && `${maybeId}` === identifier;

    return this.prismaService.user.findFirst({
      where: {
        ...(isNumericId ? { id: maybeId } : { uuid: identifier }),
      },
      include: {
        role: true,
        department: true,
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
    //update prisma
    const user = await this.prismaService.user.update({
      where: { uuid: existingUser.uuid },
      data: this.createUpdateUserInput(updateUserDto),
    });

    return user;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
