import { Controller, Get } from '@nestjs/common';
import * as Permissions from './permissions';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../guards/role.guard';
import { PERMISSIONS } from './permissions';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  @Get()
  @Roles(PERMISSIONS.PERMISSIONS_READ)
  getPermissions() {
    return Object.keys(Permissions).flatMap((k) =>
      Object.values(Permissions[k]),
    );
  }
}
