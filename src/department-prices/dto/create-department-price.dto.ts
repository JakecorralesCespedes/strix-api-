import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDepartmentPriceDto {
  @ApiProperty()
  @IsNumber()
  departmentId: number;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
