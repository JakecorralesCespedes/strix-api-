import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { WorkHoursService } from './work-hours.service';
import { WorkHours } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginatedResponse } from '../utils/pagination.util';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { GetWorkHoursDto } from './dto/get-work-hours.dto';
import { DepartmentGuard } from '../common/guards/department.guard';

@ApiTags('Work Hours')
@ApiBearerAuth()
@Controller('work-hours')
@UseGuards(DepartmentGuard)
export class WorkHoursController {
  constructor(private readonly workHoursService: WorkHoursService) {}

  @Get()
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetWorkHoursDto,
    @Req() req,
  ): Promise<PaginatedResponse<WorkHours>> {
    return this.workHoursService.findAll(query, req.user);
  }
}
