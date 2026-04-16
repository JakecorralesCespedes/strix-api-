import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkHours, WorkHoursStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
  createPaginationMetadata,
} from '../utils/pagination.util';
import { GetWorkHoursDto } from './dto/get-work-hours.dto';
import { CreateWorkHoursDto } from './dto/create-work-hours.dto';
import { UpdateWorkHoursDto } from './dto/update-work-hours.dto';
import { WORK_HOURS } from '../permissions/permissions';

export type WorkHoursResponse = Omit<
  WorkHours,
  'amount' | 'price' | 'total'
> & {
  amount: number | null;
  price: number | null;
  total: number | null;
};

@Injectable()
export class WorkHoursService {
  constructor(private readonly prismaService: PrismaService) {}

  private hasPermission(user: any, permission: string): boolean {
    if (user?.role?.name === 'Admin') {
      return true;
    }

    const allowed = user?.role?.allowedPermissions ?? [];
    return allowed.includes(permission);
  }

  private canApprove(user: any): boolean {
    return this.hasPermission(user, WORK_HOURS.WORK_HOURS_APPROVE);
  }

  private canViewFinancials(user: any): boolean {
    return this.hasPermission(user, WORK_HOURS.WORK_HOURS_FINANCIALS_READ);
  }

  private sanitizeWorkHours(
    record: WorkHours,
    canViewFinancials: boolean,
  ): WorkHoursResponse {
    if (canViewFinancials) {
      return record as WorkHoursResponse;
    }

    return {
      ...record,
      amount: null,
      price: null,
      total: null,
    } as WorkHoursResponse;
  }

  private calculateAmount(start: Date, end: Date): number {
    const diffMs = end.getTime() - start.getTime();

    if (diffMs <= 0) {
      throw new BadRequestException('Invalid time range');
    }

    return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
  }

  private normalizeDate(value: string, label: string, isEnd = false): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} must be a valid date`);
    }

    if (isEnd) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private async checkDepartmentAccess(departmentId: number, user: any) {
    if (user.role.name === 'Admin') return;

    if (user.departmentId !== departmentId) {
      throw new BadRequestException(
        `You can only manage work hours for department ${user.departmentId}`,
      );
    }
  }

  private async ensureStudentInDepartment(studentId: number, departmentId: number) {
    const relation = await this.prismaService.studentOnDepartment.findFirst({
      where: { studentId, departmentId },
    });

    if (!relation) {
      throw new BadRequestException('Student is not assigned to this department');
    }

    if (relation.status !== 'APPROVED') {
      throw new BadRequestException('Student request is not approved yet');
    }
  }

  async findAll(
    query: GetWorkHoursDto,
    user: any,
  ): Promise<PaginatedResponse<WorkHoursResponse>> {
    const {
      page = 1,
      size = 10,
      departmentId,
      studentId,
      periodId,
      status,
      startDate,
      endDate,
    } = query;
    const { take, skip } = createPaginationMetadata(page, size);

    // Build where clause: non-admins can only see their department's hours
    const where: any = {};
    if (user.role.name !== 'Admin') {
      where.departmentId = user.departmentId;
    }

    if (departmentId) {
      where.departmentId = Number(departmentId);
    }

    if (studentId) {
      where.studentId = Number(studentId);
    }

    if (periodId) {
      where.periodId = Number(periodId);
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.start = {};
      if (startDate) {
        where.start.gte = this.normalizeDate(startDate, 'startDate');
      }
      if (endDate) {
        where.start.lte = this.normalizeDate(endDate, 'endDate', true);
      }
    }

    const [workHours, total] = await Promise.all([
      this.prismaService.workHours.findMany({
        take,
        skip,
        where,
        include: {
          student: true,
          period: true,
          department: true,
          applier: true,
        },
      }),
      this.prismaService.workHours.count({ where }),
    ]);

    const canViewFinancials = this.canViewFinancials(user);
    const sanitized = workHours.map((item) =>
      this.sanitizeWorkHours(item, canViewFinancials),
    );

    return createPaginatedResponse<WorkHoursResponse>(
      sanitized,
      total,
      page,
      size,
    );
  }

  async findOne(id: number, user: any): Promise<WorkHoursResponse> {
    const record = await this.prismaService.workHours.findFirst({
      where: { id },
      include: {
        student: true,
        period: true,
        department: true,
        applier: true,
      },
    });

    if (!record) {
      throw new BadRequestException('Work hours not found');
    }

    await this.checkDepartmentAccess(record.departmentId, user);
    return this.sanitizeWorkHours(record, this.canViewFinancials(user));
  }

  async create(data: CreateWorkHoursDto, user: any): Promise<WorkHoursResponse> {
    await this.checkDepartmentAccess(data.departmentId, user);

    const department = await this.prismaService.department.findUnique({
      where: { id: data.departmentId },
    });
    if (!department) {
      throw new BadRequestException('Department not found');
    }

    const student = await this.prismaService.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student) {
      throw new BadRequestException('Student not found');
    }

    await this.ensureStudentInDepartment(data.studentId, data.departmentId);

    const period = await this.prismaService.period.findUnique({
      where: { id: data.periodId },
    });
    if (!period) {
      throw new BadRequestException('Period not found');
    }

    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    const amount = this.calculateAmount(startDate, endDate);
    const price = Number(department.pricing || 0);
    const total = amount * price;
    const status = this.canApprove(user)
      ? data.status ?? WorkHoursStatus.PENDING
      : WorkHoursStatus.PENDING;

    const created = await this.prismaService.workHours.create({
      data: {
        name: data.name,
        start: startDate,
        end: endDate,
        amount,
        price,
        total,
        status,
        registedBy: user.id,
        studentId: data.studentId,
        departmentId: data.departmentId,
        periodId: data.periodId,
      },
      include: {
        student: true,
        period: true,
        department: true,
        applier: true,
      },
    });

    return this.sanitizeWorkHours(created, this.canViewFinancials(user));
  }

  async update(
    id: number,
    data: UpdateWorkHoursDto,
    user: any,
  ): Promise<WorkHoursResponse> {
    const existing = await this.findOne(id, user);
    const nextDepartmentId = data.departmentId ?? existing.departmentId;

    await this.checkDepartmentAccess(nextDepartmentId, user);

    if (data.studentId || data.departmentId) {
      const studentId = data.studentId ?? existing.studentId;
      await this.ensureStudentInDepartment(studentId, nextDepartmentId);
    }

    if (data.periodId) {
      const period = await this.prismaService.period.findUnique({
        where: { id: data.periodId },
      });
      if (!period) {
        throw new BadRequestException('Period not found');
      }
    }

    const department = await this.prismaService.department.findUnique({
      where: { id: nextDepartmentId },
    });
    if (!department) {
      throw new BadRequestException('Department not found');
    }

    const startDate = data.start ? new Date(data.start) : existing.start;
    const endDate = data.end ? new Date(data.end) : existing.end;
    const amount = this.calculateAmount(startDate, endDate);
    const price = Number(department.pricing || 0);
    const total = amount * price;
    const status = this.canApprove(user)
      ? data.status ?? existing.status
      : existing.status;

    const updated = await this.prismaService.workHours.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        start: startDate,
        end: endDate,
        amount,
        price,
        total,
        status,
        studentId: data.studentId ?? existing.studentId,
        departmentId: nextDepartmentId,
        periodId: data.periodId ?? existing.periodId,
      },
      include: {
        student: true,
        period: true,
        department: true,
        applier: true,
      },
    });

    return this.sanitizeWorkHours(updated, this.canViewFinancials(user));
  }
}
