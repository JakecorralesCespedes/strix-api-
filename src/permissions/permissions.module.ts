import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PermissionsController } from './permissions.controller';

@Module({
  imports: [CommonModule],
  controllers: [PermissionsController],
  providers: [],
})
export class PermissionsModule {}
