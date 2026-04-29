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

  private getAllowedDepartmentIds(user: any): number[] {
    if (user?.role?.name === 'Admin') {
      return [];
    }

    const allowed = (user?.departmentRoles ?? []).map(
      (item) => item.departmentId,
    );
    if (!allowed.length && user?.departmentId) {
      allowed.push(user.departmentId);
    }

    return allowed;
  }

  private getRoleForDepartment(user: any, departmentId?: number) {
    if (!departmentId) {
      return null;
    }

    const match = (user?.departmentRoles ?? []).find(
      (item) => item.departmentId === departmentId,
    )?.role;
    if (match) {
      return match;
    }

    if (!user?.departmentRoles?.length && user?.departmentId === departmentId) {
      return user?.role ?? null;
    }

    return null;
  }

  private hasPermission(
    user: any,
    permission: string,
    departmentId?: number,
  ): boolean {
    if (user?.role?.name === 'Admin') {
      return true;
    }

    if (departmentId) {
      const role = this.getRoleForDepartment(user, departmentId);
      return (role?.allowedPermissions ?? []).includes(permission);
    }

    const roles = user?.departmentRoles ?? [];
    if (roles.length) {
      return roles.some((item) =>
        (item.role?.allowedPermissions ?? []).includes(permission),
      );
    }

    const allowed = user?.role?.allowedPermissions ?? [];
    return allowed.includes(permission);
  }

  private canApprove(user: any, departmentId?: number): boolean {
    return this.hasPermission(user, WORK_HOURS.WORK_HOURS_APPROVE, departmentId);
  }

  private canViewFinancials(user: any, departmentId?: number): boolean {
    return this.hasPermission(
      user,
      WORK_HOURS.WORK_HOURS_FINANCIALS_READ,
      departmentId,
    );
  }

  private sanitizeWorkHours(record: WorkHours, user: any): WorkHoursResponse {
    if (this.canViewFinancials(user, record.departmentId)) {
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

    const allowedDepartmentIds = this.getAllowedDepartmentIds(user);

    if (!allowedDepartmentIds.includes(departmentId)) {
      throw new BadRequestException(
        `You can only manage work hours for departments ${allowedDepartmentIds.join(', ')}`,
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

    const allowedDepartmentIds = this.getAllowedDepartmentIds(user);

    const where: any = {};
    if (user.role.name !== 'Admin') {
      if (departmentId && !allowedDepartmentIds.includes(Number(departmentId))) {
        throw new BadRequestException('Not allowed for this department');
      }

      where.departmentId = departmentId
        ? Number(departmentId)
        : {
            in: allowedDepartmentIds.length ? allowedDepartmentIds : [-1],
          };
    } else if (departmentId) {
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

    const sanitized = workHours.map((item) =>
      this.sanitizeWorkHours(item, user),
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
    return this.sanitizeWorkHours(record, user);
  }

  async findPendingCount(user: any): Promise<{ count: number }> {
    const allowedDepartmentIds = this.getAllowedDepartmentIds(user);

    const where: any = { status: WorkHoursStatus.PENDING };

    if (user.role.name !== 'Admin') {
      where.departmentId = {
        in: allowedDepartmentIds.length ? allowedDepartmentIds : [-1],
      };
    }

    const count = await this.prismaService.workHours.count({ where });
    return { count };
  }

  private async resolvePriceForDepartment(
    departmentId: number,
    priceId: number | undefined,
    fallbackPricing: number,
  ): Promise<{ price: number; priceId: number | null }> {
    if (priceId) {
      const priceRow = await this.prismaService.departmentPrice.findUnique({
        where: { id: priceId },
      });
      if (!priceRow) {
        throw new BadRequestException('El precio seleccionado no existe');
      }
      if (priceRow.departmentId !== departmentId) {
        throw new BadRequestException(
          'El precio seleccionado no pertenece a este departamento',
        );
      }
      if (!priceRow.active) {
        throw new BadRequestException('El precio seleccionado está inactivo');
      }
      return { price: priceRow.price, priceId: priceRow.id };
    }

    const activePrices = await this.prismaService.departmentPrice.findMany({
      where: { departmentId, active: true },
      orderBy: { id: 'asc' },
    });

    if (activePrices.length > 0) {
      return { price: activePrices[0].price, priceId: activePrices[0].id };
    }

    return { price: Number(fallbackPricing || 0), priceId: null };
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

    if (!data.isAdditional) {
      await this.ensureStudentInDepartment(data.studentId, data.departmentId);
    }

    const period = await this.prismaService.period.findUnique({
      where: { id: data.periodId },
    });
    if (!period) {
      throw new BadRequestException('Period not found');
    }

    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    const amount = this.calculateAmount(startDate, endDate);
    const resolved = await this.resolvePriceForDepartment(
      data.departmentId,
      data.priceId,
      department.pricing,
    );
    const total = amount * resolved.price;
    const status = WorkHoursStatus.PENDING;

    const created = await this.prismaService.workHours.create({
      data: {
        name: data.name,
        start: startDate,
        end: endDate,
        amount,
        price: resolved.price,
        total,
        status,
        isAdditional: data.isAdditional ?? false,
        registedBy: user.id,
        studentId: data.studentId,
        departmentId: data.departmentId,
        periodId: data.periodId,
        priceId: resolved.priceId,
      },
      include: {
        student: true,
        period: true,
        department: true,
        applier: true,
      },
    });

    return this.sanitizeWorkHours(created, user);
  }

  async update(
    id: number,
    data: UpdateWorkHoursDto,
    user: any,
  ): Promise<WorkHoursResponse> {
    const existing = await this.findOne(id, user);
    const nextDepartmentId = data.departmentId ?? existing.departmentId;

    await this.checkDepartmentAccess(nextDepartmentId, user);

    const isAdditional = data.isAdditional ?? existing.isAdditional;

    if (!isAdditional && (data.studentId || data.departmentId)) {
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
    const priceIdInput = data.priceId !== undefined ? data.priceId : existing.priceId ?? undefined;
    const resolved = await this.resolvePriceForDepartment(
      nextDepartmentId,
      priceIdInput ?? undefined,
      department.pricing,
    );
    const total = amount * resolved.price;
    const status = this.canApprove(user, nextDepartmentId)
      ? data.status ?? existing.status
      : existing.status;

    const updated = await this.prismaService.workHours.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        start: startDate,
        end: endDate,
        amount,
        price: resolved.price,
        total,
        status,
        isAdditional,
        studentId: data.studentId ?? existing.studentId,
        departmentId: nextDepartmentId,
        periodId: data.periodId ?? existing.periodId,
        priceId: resolved.priceId,
      },
      include: {
        student: true,
        period: true,
        department: true,
        applier: true,
      },
    });

    return this.sanitizeWorkHours(updated, user);
  }
}
