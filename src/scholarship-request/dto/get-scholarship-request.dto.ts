import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/utils/pagination.util';
import { RequestStatus } from '@prisma/client';

export class GetScholarshipRequestDto extends PaginationQueryDto {
	@ApiPropertyOptional()
	@IsOptional()
	departmentId?: number;

	@ApiPropertyOptional({ enum: RequestStatus })
	@IsOptional()
	@IsEnum(RequestStatus)
	status?: RequestStatus;
}
