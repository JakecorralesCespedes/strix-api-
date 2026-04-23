import { Controller, Get, Post, Body, Param, Query, Put, Req, UseGuards } from '@nestjs/common';
import { ScholarshipRequestService } from './scholarship-request.service';
import { CreateScholarshipRequestDto } from './dto/create-scholarship-request.dto';
import { UpdateScholarshipRequestDto } from './dto/update-scholarship-request.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetScholarshipRequestDto } from './dto/get-scholarship-request.dto';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { PaginatedResponse } from '../utils/pagination.util';
import { StudentOnDepartment } from '@prisma/client';
import { DepartmentGuard } from '../common/guards/department.guard';
import { Roles } from '../guards/role.guard';
import { SCHOLARSHIP_REQUESTS } from '../permissions/permissions';

@ApiTags('ScholarshipRequest')
@ApiBearerAuth()
@Controller('scholarship-request')
@UseGuards(DepartmentGuard)
export class ScholarshipRequestController {
  constructor(
    private readonly scholarshipRequestService: ScholarshipRequestService,
  ) {}

  @Post()
  @Roles(SCHOLARSHIP_REQUESTS.SCHOLARSHIP_WRITE)
  async create(
    @Body() createScholarshipRequestDto: CreateScholarshipRequestDto,
    @Req() req,
  ) {
    return this.scholarshipRequestService.createScholarshipRequest(
      createScholarshipRequestDto,
      req.user,
    );
  }

  @Get()
  @Roles(SCHOLARSHIP_REQUESTS.SCHOLARSHIP_READ)
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetScholarshipRequestDto,
    @Req() req,
  ): Promise<PaginatedResponse<StudentOnDepartment>> {
    return this.scholarshipRequestService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(SCHOLARSHIP_REQUESTS.SCHOLARSHIP_READ)
  findOne(@Param('id') id: string, @Req() req) {
    return this.scholarshipRequestService.findOne(Number(id), req.user);
  }

  @Put(':id')
  @Roles(SCHOLARSHIP_REQUESTS.SCHOLARSHIP_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateScholarshipRequestDto: UpdateScholarshipRequestDto,
    @Req() req,
  ) {
    return this.scholarshipRequestService.update(
      Number(id),
      updateScholarshipRequestDto,
      req.user,
    );
  }
}
