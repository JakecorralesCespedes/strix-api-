import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { WorkHoursResponse, WorkHoursService } from './work-hours.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginatedResponse } from '../utils/pagination.util';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { GetWorkHoursDto } from './dto/get-work-hours.dto';
import { DepartmentGuard } from '../common/guards/department.guard';
import { CreateWorkHoursDto } from './dto/create-work-hours.dto';
import { UpdateWorkHoursDto } from './dto/update-work-hours.dto';
import { Roles } from '../guards/role.guard';
import { WORK_HOURS } from '../permissions/permissions';
import { PdfReportService } from '../common/pdf-report.service';

@ApiTags('Work Hours')
@ApiBearerAuth()
@Controller('work-hours')
@UseGuards(DepartmentGuard)
export class WorkHoursController {
  constructor(
    private readonly workHoursService: WorkHoursService,
    private readonly pdfReportService: PdfReportService,
  ) {}

  @Get()
  @Roles(WORK_HOURS.WORK_HOURS_READ)
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetWorkHoursDto,
    @Req() req,
  ): Promise<PaginatedResponse<WorkHoursResponse>> {
    return this.workHoursService.findAll(query, req.user);
  }

  @Get('pending-count')
  @Roles(WORK_HOURS.WORK_HOURS_READ)
  async pendingCount(@Req() req): Promise<{ count: number }> {
    return this.workHoursService.findPendingCount(req.user);
  }

  @Get('report')
  @Roles(WORK_HOURS.WORK_HOURS_READ)
  async report(
    @Query()
    query: {
      periodId?: string;
      departmentId?: string;
      studentId?: string;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
      startDate?: string;
      endDate?: string;
    },
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    const pdf = await this.pdfReportService.renderWorkHoursReport({
      periodId: query.periodId ? Number(query.periodId) : undefined,
      departmentId: query.departmentId ? Number(query.departmentId) : undefined,
      studentId: query.studentId ? Number(query.studentId) : undefined,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        'attachment; filename="reporte-horas-beca.pdf"',
      )
      .send(pdf);
  }

  @Get(':id')
  @Roles(WORK_HOURS.WORK_HOURS_READ)
  async findOne(
    @Param('id') id: string,
    @Req() req,
  ): Promise<WorkHoursResponse> {
    return this.workHoursService.findOne(Number(id), req.user);
  }

  @Post()
  @Roles(WORK_HOURS.WORK_HOURS_WRITE)
  async create(
    @Body() data: CreateWorkHoursDto,
    @Req() req,
  ): Promise<WorkHoursResponse> {
    return this.workHoursService.create(data, req.user);
  }

  @Put(':id')
  @Roles(WORK_HOURS.WORK_HOURS_WRITE)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateWorkHoursDto,
    @Req() req,
  ): Promise<WorkHoursResponse> {
    return this.workHoursService.update(Number(id), data, req.user);
  }
}
