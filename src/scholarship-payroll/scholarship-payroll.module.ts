import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ScholarshipPayrollController } from './scholarship-payroll.controller';
import { ScholarshipPayrollService } from './scholarship-payroll.service';

@Module({
  imports: [CommonModule],
  controllers: [ScholarshipPayrollController],
  providers: [ScholarshipPayrollService],
})
export class ScholarshipPayrollModule {}
