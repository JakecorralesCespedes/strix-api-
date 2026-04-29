import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { CreateDepartamentDto } from './create-departament.dto';

export class UpdateDepartamentDto extends PartialType(CreateDepartamentDto) {
	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	headId?: number | null;
}
