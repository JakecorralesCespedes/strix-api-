import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class ApplyPayrollDto {
  @ApiProperty()
  @IsNumber()
  periodId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  departmentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  closePeriod?: boolean;
}
