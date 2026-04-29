import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class DepartmentRoleAssignmentDto {
  @ApiProperty()
  @IsNumber()
  departmentId: number;

  @ApiProperty()
  @IsNumber()
  roleId: number;
}

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  name: string;
  @ApiProperty()
  @IsString()
  email: string;
  @ApiProperty()
  @IsString()
  password: string;
  @ApiProperty()
  @IsString()
  phone: string;
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  roleId?: number;
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  departmentId?: number;

  @ApiProperty({ required: false, type: [DepartmentRoleAssignmentDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DepartmentRoleAssignmentDto)
  departmentRoles?: DepartmentRoleAssignmentDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  activeDepartmentId?: number;
}
