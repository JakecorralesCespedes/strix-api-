import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepartmentGuard } from '../common/guards/department.guard';
import { ScholarshipPayrollService } from './scholarship-payroll.service';
import { PreviewPayrollDto } from './dto/preview-payroll.dto';
import { ApplyPayrollDto } from './dto/apply-payroll.dto';

@ApiTags('Scholarship Payroll')
@ApiBearerAuth()
@Controller('scholarship-payroll')
@UseGuards(DepartmentGuard)
export class ScholarshipPayrollController {
  constructor(private readonly scholarshipPayrollService: ScholarshipPayrollService) {}

  @Get('preview')
  async preview(@Query() query: PreviewPayrollDto, @Req() req) {
    return this.scholarshipPayrollService.preview(query, req.user);
  }

  @Post('apply')
  async apply(@Body() body: ApplyPayrollDto, @Req() req) {
    return this.scholarshipPayrollService.apply(body, req.user);
  }
}
