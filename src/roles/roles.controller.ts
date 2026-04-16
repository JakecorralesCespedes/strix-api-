import { Controller, Get, Post, Body, Param, Query, Put } from '@nestjs/common';
import { RolesService } from './roles.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { GetRoleDto } from './dto/get-role.dto';
import { Role } from '@prisma/client';
import { PaginatedResponse } from '../utils/pagination.util';
import { CreateRoleDto } from './dto/create-role.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { Roles } from '../guards/role.guard';
import { ROLES } from '../permissions/permissions';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(ROLES.ROLES_WRITE)
  async create(@Body() body: CreateRoleDto): Promise<Role> {
    return this.rolesService.createRole(body);
  }

  @Get()
  @Roles(ROLES.ROLES_READ)
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetRoleDto,
  ): Promise<PaginatedResponse<Role>> {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @Roles(ROLES.ROLES_READ)
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(Number(id));
  }

  @Put(':id')
  @Roles(ROLES.ROLES_WRITE)
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.updaterole(Number(id), updateRoleDto);
  }
}
