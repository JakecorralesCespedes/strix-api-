import { Module } from '@nestjs/common';
import { FirebaseService } from './fireabase.service';
import { PrismaService } from './prisma.service';
import { MailerService } from './mailer.service';

@Module({
  controllers: [],
  providers: [FirebaseService, PrismaService, MailerService],
  exports: [FirebaseService, PrismaService, MailerService],
})
export class CommonModule {}
