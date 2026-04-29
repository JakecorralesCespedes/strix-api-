import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';

export class PreviewPayrollDto {
  @ApiProperty()
  @IsNumberString()
  periodId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  departmentId?: string;
}
