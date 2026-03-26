import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { RecordExitDto } from './dto/record-exit.dto';
import { DepartmentGuard } from '../common/guards/department.guard';

@Controller('time-entries')
@UseGuards(DepartmentGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post('record-entry')
  async recordEntry(@Body() createTimeEntryDto: CreateTimeEntryDto) {
    return await this.timeEntriesService.recordEntry(createTimeEntryDto);
  }

  @Patch(':id/record-exit')
  async recordExit(
    @Param('id') id: string,
    @Body() recordExitDto: RecordExitDto,
  ) {
    return await this.timeEntriesService.recordExit(Number(id), recordExitDto);
  }

  @Get('my-today')
  async getMyTodayEntries(@Req() req) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User not found in request');
    }
    return await this.timeEntriesService.getUserTodayEntries(
      user.id,
      user.departmentId,
    );
  }

  @Get('department/:departmentId')
  async getDepartmentEntries(
    @Param('departmentId') departmentId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return await this.timeEntriesService.getDepartmentEntries(
      Number(departmentId),
      from,
      to,
    );
  }
}
