import { IsNumber } from 'class-validator';

export class CreateTimeEntryDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  departmentId: number;
}
