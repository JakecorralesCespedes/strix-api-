import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../utils/pagination.util';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetPeriodDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
