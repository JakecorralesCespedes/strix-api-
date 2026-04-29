import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { DepartmentPricesController } from './department-prices.controller';
import { DepartmentPricesService } from './department-prices.service';

@Module({
  imports: [CommonModule],
  controllers: [DepartmentPricesController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
    DepartmentPricesService,
  ],
  exports: [DepartmentPricesService],
})
export class DepartmentPricesModule {}
