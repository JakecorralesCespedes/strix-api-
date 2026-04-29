import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../utils/pagination.util';
import { WorkHoursStatus } from '@prisma/client';

export class GetWorkHoursDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  departmentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  studentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  periodId?: number;

  @ApiPropertyOptional({ enum: WorkHoursStatus })
  @IsOptional()
  @IsEnum(WorkHoursStatus)
  status?: WorkHoursStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
