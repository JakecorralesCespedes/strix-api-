import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { WorkHoursStatus } from '@prisma/client';

export class CreateWorkHoursDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsDateString()
  start: string;

  @ApiProperty()
  @IsDateString()
  end: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ enum: WorkHoursStatus })
  @IsOptional()
  @IsEnum(WorkHoursStatus)
  status?: WorkHoursStatus;

  @ApiProperty()
  @IsNumber()
  studentId: number;

  @ApiProperty()
  @IsNumber()
  departmentId: number;

  @ApiProperty()
  @IsNumber()
  periodId: number;
}