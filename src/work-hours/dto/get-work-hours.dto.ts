import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../utils/pagination.util';

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
}
