import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service';
import { MailerService } from '../common/mailer.service';
import { UpdateConfigsDto } from './dto/update-configs.dto';
import { UpdatePdfTemplateDto } from './dto/update-pdf-template.dto';
import {
  DEFAULT_PDF_TEMPLATE,
  PDF_TEMPLATE_KEYS,
  PdfTemplateConfig,
} from '../common/pdf-template.config';
import { Prisma } from '@prisma/client';

@Injectable()
export class GlobalConfigsService {
  constructor(
    private prismaservice: PrismaService,
    private mailerService: MailerService,
  ) {}

  private updateQuery(
    key: string,
    value: string,
  ): Prisma.GlobalSettingUpsertArgs {
    return {
      where: { key },
      update: {
        key,
        value,
      },
      create: {
        key,
        value,
      },
    };
  }

  private async readSettings(): Promise<Record<string, string>> {
    const configsArray = await this.prismaservice.globalSetting.findMany();
    return configsArray.reduce<Record<string, string>>((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {});
  }

  async getGlobalConfigs() {
    const configsObject = await this.readSettings();
    return {
      defaultPrice: configsObject['defaultPrice'] || '',
      scolarshipCode: configsObject['scolarshipCode'] || '',
      studentsCode: configsObject['studentsCode'] || '',
      tithCode: configsObject['tithCode'] || '',
    };
  }

  async updateGlobalConfigs(updateConfigsDto: UpdateConfigsDto) {
    const updates = Object.entries(updateConfigsDto).map(([key, value]) =>
      this.prismaservice.globalSetting.upsert(this.updateQuery(key, value)),
    );
    return Promise.all(updates);
  }

  async getPdfTemplate(): Promise<PdfTemplateConfig> {
    const settings = await this.readSettings();
    const result = { ...DEFAULT_PDF_TEMPLATE };
    for (const key of PDF_TEMPLATE_KEYS) {
      const stored = settings[key];
      if (typeof stored === 'string' && stored.trim().length > 0) {
        result[key] = stored;
      }
    }
    return result;
  }

  async updatePdfTemplate(
    dto: UpdatePdfTemplateDto,
  ): Promise<PdfTemplateConfig> {
    const updates = Object.entries(dto)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) =>
        this.prismaservice.globalSetting.upsert(
          this.updateQuery(key, value as string),
        ),
      );
    await Promise.all(updates);
    return this.getPdfTemplate();
  }

  getSmtpStatus() {
    const configured = this.mailerService.isConfigured();
    return {
      configured,
      requiredEnvVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'],
      optionalEnvVars: ['SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE'],
      note: configured
        ? 'Servicio de correo activo.'
        : 'Correos deshabilitados. Configura las variables de entorno SMTP en el servidor para habilitarlos.',
    };
  }
}
