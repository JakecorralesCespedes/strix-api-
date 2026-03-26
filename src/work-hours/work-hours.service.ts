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

@Injectable()
export class WorkHoursService {
  constructor(private readonly prismaService: PrismaService) {}

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
  ): Promise<PaginatedResponse<WorkHours>> {
    const { page = 1, size = 10 } = query;
    const { take, skip } = createPaginationMetadata(page, size);

    // Build where clause: non-admins can only see their department's hours
    const where: any = {};
    if (user.role.name !== 'Admin') {
      where.departmentId = user.departmentId;
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

    return createPaginatedResponse<WorkHours>(workHours, total, page, size);
  }

  async findOne(id: number, user: any): Promise<WorkHours> {
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
    return record;
  }

  async create(data: CreateWorkHoursDto, user: any): Promise<WorkHours> {
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

    const total = data.amount * data.price;

    return this.prismaService.workHours.create({
      data: {
        name: data.name,
        start: new Date(data.start),
        end: new Date(data.end),
        amount: data.amount,
        price: data.price,
        total,
        status: data.status ?? WorkHoursStatus.PENDING,
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
  }

  async update(
    id: number,
    data: UpdateWorkHoursDto,
    user: any,
  ): Promise<WorkHours> {
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

    const amount = data.amount ?? existing.amount;
    const price = data.price ?? existing.price;
    const total = amount * price;

    return this.prismaService.workHours.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        start: data.start ? new Date(data.start) : existing.start,
        end: data.end ? new Date(data.end) : existing.end,
        amount,
        price,
        total,
        status: data.status ?? existing.status,
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
  }
}
