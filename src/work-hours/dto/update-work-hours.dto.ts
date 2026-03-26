import { PartialType } from '@nestjs/swagger';
import { CreateWorkHoursDto } from './create-work-hours.dto';

export class UpdateWorkHoursDto extends PartialType(CreateWorkHoursDto) {}