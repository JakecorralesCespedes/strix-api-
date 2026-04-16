import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WorkHoursStatus } from '@prisma/client';
import { PreviewPayrollDto } from './dto/preview-payroll.dto';
import { ApplyPayrollDto } from './dto/apply-payroll.dto';

const DEFAULT_TITHE_RATE = 0.1;
const DEFAULT_RECEIVABLE_RATE = 0;

export type PayrollPreviewItem = {
  studentId: number;
  departmentId: number;
  periodId: number;
  hours: number;
  pricePerHour: number;
  amount: number;
  subtotal: number;
  tithe: number;
  total: number;
  payable: number;
  receivable: number;
  workHoursIds: number[];
  student: any;
  department: any;
  period: any;
};

export type PayrollPreviewTotals = {
  hours: number;
  amount: number;
  subtotal: number;
  tithe: number;
  total: number;
  payable: number;
  receivable: number;
};

@Injectable()
export class ScholarshipPayrollService {
  constructor(private readonly prismaService: PrismaService) {}

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private normalizeNumber(value: unknown, label: string): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException(`${label} must be a valid number`);
    }
    return num;
  }

  private async getRateSetting(key: string, fallback: number): Promise<number> {
    const record = await this.prismaService.globalSetting.findUnique({
      where: { key },
    });

    if (!record?.value) {
      return fallback;
    }

    const parsed = Number(record.value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    if (parsed > 1) {
      return this.round(parsed / 100);
    }

    if (parsed < 0) {
      return fallback;
    }

    return parsed;
  }

  private async buildPreview(
    input: { periodId: number; departmentId?: number },
    user: any,
  ): Promise<{ items: PayrollPreviewItem[]; totals: PayrollPreviewTotals }> {
    const { periodId, departmentId } = input;

    if (user?.role?.name !== 'Admin' && departmentId) {
      if (user.departmentId !== departmentId) {
        throw new BadRequestException('Not allowed for this department');
      }
    }

    const where: any = {
      periodId,
      status: WorkHoursStatus.APPROVED,
      appliedHourId: null,
    };

    if (departmentId) {
      where.departmentId = departmentId;
    } else if (user?.role?.name !== 'Admin') {
      where.departmentId = user.departmentId;
    }

    const workHours = await this.prismaService.workHours.findMany({
      where,
      include: {
        student: true,
        department: true,
        period: true,
      },
      orderBy: {
        studentId: 'asc',
      },
    });

    const titheRate = await this.getRateSetting('titheRate', DEFAULT_TITHE_RATE);
    const receivableRate = await this.getRateSetting(
      'receivableRate',
      DEFAULT_RECEIVABLE_RATE,
    );

    const groups = new Map<string, { workHours: any[]; student: any; department: any; period: any }>();

    for (const entry of workHours) {
      const key = `${entry.studentId}-${entry.departmentId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          workHours: [],
          student: entry.student,
          department: entry.department,
          period: entry.period,
        });
      }
      groups.get(key)?.workHours.push(entry);
    }

    const items: PayrollPreviewItem[] = [];

    for (const group of groups.values()) {
      const totalHours = group.workHours.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0,
      );

      const pricePerHour = Number(group.department?.pricing || 0);
      const subtotal = this.round(totalHours * pricePerHour);
      const amount = subtotal;
      const tithe = this.round(subtotal * titheRate);
      const total = this.round(subtotal - tithe);
      const receivable = this.round(total * receivableRate);
      const payable = this.round(total - receivable);

      items.push({
        studentId: group.student.id,
        departmentId: group.department.id,
        periodId: group.period.id,
        hours: this.round(totalHours),
        pricePerHour,
        amount,
        subtotal,
        tithe,
        total,
        payable,
        receivable,
        workHoursIds: group.workHours.map((item) => item.id),
        student: group.student,
        department: group.department,
        period: group.period,
      });
    }

    const totals = items.reduce(
      (acc, item) => {
        acc.hours += item.hours;
        acc.amount += item.amount;
        acc.subtotal += item.subtotal;
        acc.tithe += item.tithe;
        acc.total += item.total;
        acc.payable += item.payable;
        acc.receivable += item.receivable;
        return acc;
      },
      {
        hours: 0,
        amount: 0,
        subtotal: 0,
        tithe: 0,
        total: 0,
        payable: 0,
        receivable: 0,
      } as PayrollPreviewTotals,
    );

    Object.keys(totals).forEach((key) => {
      totals[key] = this.round(totals[key]);
    });

    return { items, totals };
  }

  async preview(query: PreviewPayrollDto, user: any) {
    const periodId = this.normalizeNumber(query.periodId, 'periodId');
    const departmentId = query.departmentId
      ? this.normalizeNumber(query.departmentId, 'departmentId')
      : undefined;

    return this.buildPreview({ periodId, departmentId }, user);
  }

  async apply(body: ApplyPayrollDto, user: any) {
    const periodId = this.normalizeNumber(body.periodId, 'periodId');
    const departmentId = body.departmentId
      ? this.normalizeNumber(body.departmentId, 'departmentId')
      : undefined;

    const period = await this.prismaService.period.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new BadRequestException('Period not found');
    }

    const { items, totals } = await this.buildPreview(
      { periodId, departmentId },
      user,
    );

    const applied: any[] = [];

    for (const item of items) {
      const result = await this.prismaService.$transaction(async (tx) => {
        const payroll = await tx.scholarshipPayroll.create({
          data: {
            hours: item.hours,
            amount: item.amount,
            subtotal: item.subtotal,
            tithe: item.tithe,
            total: item.total,
            payable: item.payable,
            recivable: item.receivable,
            studentId: item.studentId,
            departmentId: item.departmentId,
            periodId: item.periodId,
            appliedBy: user.id,
          },
          include: {
            student: true,
            department: true,
            period: true,
          },
        });

        await tx.workHours.updateMany({
          where: { id: { in: item.workHoursIds } },
          data: { appliedHourId: payroll.id },
        });

        return payroll;
      });

      applied.push(result);
    }

    if (body.closePeriod) {
      await this.prismaService.period.update({
        where: { id: periodId },
        data: { status: 'CLOSED' },
      });
    }

    return {
      appliedCount: applied.length,
      items: applied,
      totals,
    };
  }
}
