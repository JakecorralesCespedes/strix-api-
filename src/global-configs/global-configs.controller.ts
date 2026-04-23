// global-configs.controller.ts
import { Controller, Get, Put, Body } from '@nestjs/common';
import { GlobalConfigsService } from './global-configs.service';
import { UpdateConfigsDto } from './dto/update-configs.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../guards/role.guard';
import { GLOBAL_SETTINGS } from '../permissions/permissions';

@ApiTags('Global Configs')
@ApiBearerAuth()
@Controller('global-configs')
export class GlobalConfigsController {
  constructor(private readonly globalConfigsService: GlobalConfigsService) {}

  @Get()
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTINGS_READ)
  async getGlobalConfigs() {
    return this.globalConfigsService.getGlobalConfigs();
  }

  @Put()
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTING_UPDATE)
  async updateGlobalConfigs(@Body() updateConfigsDto: UpdateConfigsDto) {
    return this.globalConfigsService.updateGlobalConfigs(updateConfigsDto);
  }

  @Get('smtp-status')
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTINGS_READ)
  getSmtpStatus() {
    return this.globalConfigsService.getSmtpStatus();
  }
}
