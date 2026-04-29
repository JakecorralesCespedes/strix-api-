import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentPriceDto } from './create-department-price.dto';

export class UpdateDepartmentPriceDto extends PartialType(CreateDepartmentPriceDto) {}
