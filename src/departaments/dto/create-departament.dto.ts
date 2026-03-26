import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDepartamentDto {
  @ApiProperty()
  @IsString()
  name: string;
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  pricing?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  pricingId?: number;
}
