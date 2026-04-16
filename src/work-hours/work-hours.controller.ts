import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { WorkHoursResponse, WorkHoursService } from './work-hours.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginatedResponse } from '../utils/pagination.util';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { GetWorkHoursDto } from './dto/get-work-hours.dto';
import { DepartmentGuard } from '../common/guards/department.guard';
import { CreateWorkHoursDto } from './dto/create-work-hours.dto';
import { UpdateWorkHoursDto } from './dto/update-work-hours.dto';

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
  ): Promise<PaginatedResponse<WorkHoursResponse>> {
    return this.workHoursService.findAll(query, req.user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req,
  ): Promise<WorkHoursResponse> {
    return this.workHoursService.findOne(Number(id), req.user);
  }

  @Post()
  async create(
    @Body() data: CreateWorkHoursDto,
    @Req() req,
  ): Promise<WorkHoursResponse> {
    return this.workHoursService.create(data, req.user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateWorkHoursDto,
    @Req() req,
  ): Promise<WorkHoursResponse> {
    return this.workHoursService.update(Number(id), data, req.user);
  }
}
