import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateScholarshipRequestDto {
  @ApiProperty()
  @IsNumber()
  departmentId: number;

  @ApiProperty()
  @IsEnum(RequestStatus)
  status: RequestStatus;

  // Opcion A: usar un estudiante existente
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  studentId?: number;

  // Opcion B: llenar datos del estudiante en la misma solicitud.
  // Si viene `code`, el backend hace upsert (busca por code; si no existe, lo crea).
  @ApiPropertyOptional()
  @ValidateIf((o) => !o.studentId)
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.studentId)
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.studentId)
  @IsString()
  code?: string;
}
