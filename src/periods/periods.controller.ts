import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Res,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { Period } from '@prisma/client';
import { PaginatedResponse } from '../utils/pagination.util';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { GetPeriodDto } from './dto/get-period.dto';
import { Roles } from '../guards/role.guard';
import { PERIODS } from '../permissions/permissions';
import { PdfReportService } from '../common/pdf-report.service';

@ApiTags('Periods')
@ApiBearerAuth()
@Controller('periods')
export class PeriodsController {
  constructor(
    private readonly periodsService: PeriodsService,
    private readonly pdfReportService: PdfReportService,
  ) {}

  @Get()
  @Roles(PERIODS.PERIODS_READ)
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetPeriodDto,
  ): Promise<PaginatedResponse<Period>> {
    return this.periodsService.findAll(query);
  }

  @Get(':id')
  @Roles(PERIODS.PERIODS_READ)
  async findOne(@Param('id') id: string): Promise<Period> {
    return this.periodsService.findOne(Number(id));
  }

  @Get(':id/report')
  @Roles(PERIODS.PERIODS_READ)
  async downloadReport(
    @Param('id') id: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    const periodId = Number(id);
    const period = await this.periodsService.findOne(periodId);
    const pdf =
      await this.pdfReportService.renderPeriodConsolidatedReport(periodId);
    const safeName = (period?.name ?? `periodo-${periodId}`).replace(
      /\s+/g,
      '_',
    );
    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="reporte-${safeName}.pdf"`,
      )
      .send(pdf);
  }

  @Post()
  @Roles(PERIODS.PERIODS_WRITE)
  async create(@Body() body: CreatePeriodDto): Promise<Period> {
    return this.periodsService.createPeriod(body);
  }

  @Put(':id')
  @Roles(PERIODS.PERIODS_WRITE)
  async update(
    @Body() body: UpdatePeriodDto,
    @Param('id') id: string,
  ): Promise<Period> {
    return this.periodsService.updatePeriod(Number(id), body);
  }

  @Post(':id/close')
  @Roles(PERIODS.PERIODS_WRITE)
  async close(@Param('id') id: string) {
    return this.periodsService.closePeriod(Number(id));
  }

  @Post(':id/reopen')
  @Roles(PERIODS.PERIODS_REOPEN)
  async reopen(
    @Param('id') id: string,
    @Body() body: { status?: 'ACTIVE' | 'FINISHED' | 'PENDING' },
  ) {
    return this.periodsService.reopenPeriod(Number(id), body?.status as any);
  }
}
