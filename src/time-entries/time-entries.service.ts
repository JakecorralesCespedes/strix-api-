import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { RecordExitDto } from './dto/record-exit.dto';

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEntry(createTimeEntryDto: CreateTimeEntryDto) {
    return await this.prisma.timeEntry.create({
      data: {
        userId: createTimeEntryDto.userId,
        departmentId: createTimeEntryDto.departmentId,
        entryTime: new Date(),
      },
      include: {
        user: true,
        department: true,
      },
    });
  }

  async recordExit(timeEntryId: number, recordExitDto: RecordExitDto) {
    return await this.prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: {
        exitTime: new Date(),
      },
      include: {
        user: true,
        department: true,
      },
    });
  }

  async getUserTodayEntries(userId: number, departmentId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.timeEntry.findMany({
      where: {
        userId,
        departmentId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });
  }

  async getDepartmentEntries(departmentId: number, dateFrom?: Date, dateTo?: Date) {
    const where: any = { departmentId };
    
    if (dateFrom || dateTo) {
      where.entryTime = {};
      if (dateFrom) where.entryTime.gte = dateFrom;
      if (dateTo) where.entryTime.lt = dateTo;
    }

    return await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });
  }
}
