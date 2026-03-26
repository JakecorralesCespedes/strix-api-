import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { CommonModule } from '../common/common.module';
import { PriceController } from './price.controller';
import { PriceService } from './price.service';

@Module({
  imports: [CommonModule],
  controllers: [PriceController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
    PriceService,
  ],
})
export class PriceModule {}
