import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService, UserWithRoleDepartment } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedResponse } from '../utils/pagination.util';
import { GetUsersDto } from './dto/get-users.dto';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { PrismaService } from '../common/prisma.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetUsersDto,
  ): Promise<PaginatedResponse<User>> {
    return this.usersService.findAll(query);
  }

  @Get('me')
  async me(
    @Req() req: { raw: AuthenticatedRequest },
  ): Promise<UserWithRoleDepartment> {
    const firebaseUser = req.raw.firebaseUser;
    let user = await this.usersService.findOne(firebaseUser.uid);

    // Auto-create user if not found in DB but authenticated in Firebase
    if (!user) {
      // Determine role based on email
      let roleId = 2; // Default to basic role
      if (firebaseUser.email === 'jakecorrales24@gmail.com') {
        // Get Admin role for this user
        const adminRole = await this.prismaService.role.findFirst({
          where: { name: 'Admin' },
        });
        if (adminRole) {
          roleId = adminRole.id;
        }
      }

      user = await this.usersService.createFromFirebase(
        {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.name,
        },
        roleId,
      );
    }

    return user;
  }

  @Get(':identifier')
  async findOne(
    @Param('identifier') identifier: string,
  ): Promise<UserWithRoleDepartment> {
    const user = await this.usersService.findOne(identifier);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Post()
  async create(@Body() body: CreateUserDto): Promise<User> {
    return this.usersService.create(body);
  }

  @Put(':identifier')
  async update(
    @Body() body: UpdateUserDto,
    @Param('identifier') identifier: string,
  ): Promise<User> {
    return this.usersService.update(identifier, body);
  }
}
