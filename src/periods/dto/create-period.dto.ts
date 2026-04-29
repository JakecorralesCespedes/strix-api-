import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class CreatePeriodDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'ISO 8601 date string' })
  @IsDateString()
  start: string;

  @ApiProperty({ description: 'ISO 8601 date string' })
  @IsDateString()
  end: string;
}
