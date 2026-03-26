import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { WorkHoursController } from './work-hours.controller';
import { WorkHoursService } from './work-hours.service';

@Module({
  imports: [CommonModule],
  providers: [WorkHoursService],
  controllers: [WorkHoursController],
})
export class WorkHoursModule {}
