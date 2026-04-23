import { Module } from '@nestjs/common';
import { FirebaseService } from './fireabase.service';
import { PrismaService } from './prisma.service';
import { MailerService } from './mailer.service';
import { PdfReportService } from './pdf-report.service';

@Module({
  controllers: [],
  providers: [FirebaseService, PrismaService, MailerService, PdfReportService],
  exports: [FirebaseService, PrismaService, MailerService, PdfReportService],
})
export class CommonModule {}
