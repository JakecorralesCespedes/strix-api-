// global-configs.controller.ts
import { Controller, Get, Put, Body } from '@nestjs/common';
import { GlobalConfigsService } from './global-configs.service';
import { UpdateConfigsDto } from './dto/update-configs.dto';
import { UpdatePdfTemplateDto } from './dto/update-pdf-template.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../guards/role.guard';
import { GLOBAL_SETTINGS } from '../permissions/permissions';
import { MailerService, NotificationKey } from '../common/mailer.service';

@ApiTags('Global Configs')
@ApiBearerAuth()
@Controller('global-configs')
export class GlobalConfigsController {
  constructor(
    private readonly globalConfigsService: GlobalConfigsService,
    private readonly mailerService: MailerService,
  ) {}

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

  @Get('pdf-template')
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTINGS_READ)
  getPdfTemplate() {
    return this.globalConfigsService.getPdfTemplate();
  }

  @Put('pdf-template')
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTING_UPDATE)
  updatePdfTemplate(@Body() dto: UpdatePdfTemplateDto) {
    return this.globalConfigsService.updatePdfTemplate(dto);
  }

  @Get('notifications')
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTINGS_READ)
  getNotificationToggles() {
    return this.mailerService.getNotificationToggles();
  }

  @Put('notifications')
  @Roles(GLOBAL_SETTINGS.GLOBAL_SETTING_UPDATE)
  updateNotificationToggles(
    @Body() body: Partial<Record<NotificationKey, boolean>>,
  ) {
    return this.mailerService.updateNotificationToggles(body);
  }
}
