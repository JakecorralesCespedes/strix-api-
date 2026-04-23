import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateScholarshipRequestDto } from './dto/create-scholarship-request.dto';
import { UpdateScholarshipRequestDto } from './dto/update-scholarship-request.dto';
import { GetScholarshipRequestDto } from './dto/get-scholarship-request.dto';
import { PrismaService } from '../common/prisma.service';
import { StudentOnDepartment } from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
  createPaginationMetadata,
} from '../utils/pagination.util';
import { MailerService } from '../common/mailer.service';

@Injectable()
export class ScholarshipRequestService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

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

  private async checkDepartmentAccess(departmentId: number, user: any) {
    if (user.role.name === 'Admin') return;

    const allowedDepartmentIds = this.getAllowedDepartmentIds(user);

    if (!allowedDepartmentIds.includes(departmentId)) {
      throw new BadRequestException(
        `You can only manage scholarship requests for departments ${allowedDepartmentIds.join(', ')}`,
      );
    }
  }

  async createScholarshipRequest(
    data: CreateScholarshipRequestDto,
    user: any,
  ): Promise<StudentOnDepartment> {
    await this.checkDepartmentAccess(data.departmentId, user);

    const departament = await this.prismaService.department.findUnique({
      where: {
        id: data.departmentId,
      },
    });
    if (!departament) {
      throw new BadRequestException('Department not found');
    }
    const student = await this.prismaService.student.findUnique({
      where: {
        id: data.studentId,
      },
    });
    if (!student) {
      throw new BadRequestException('Student not found');
    }

    const existing = await this.prismaService.studentOnDepartment.findFirst({
      where: { studentId: data.studentId, departmentId: data.departmentId },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya existe una solicitud para este estudiante en este departamento',
      );
    }

    return this.prismaService.studentOnDepartment.create({
      data: {
        status: data.status,
        department: {
          connect: {
            id: data.departmentId,
          },
        },
        student: {
          connect: {
            id: data.studentId,
          },
        },
      },
    });
  }

  async findAll(
    query: GetScholarshipRequestDto,
    user: any,
  ): Promise<PaginatedResponse<StudentOnDepartment>> {
    const { page = 1, size = 10, departmentId, status } = query;
    const { take, skip } = createPaginationMetadata(page, size);

    // Build where clause: non-admins only see their department
    const where: any = {};
    if (user.role.name !== 'Admin') {
      const allowedDepartmentIds = this.getAllowedDepartmentIds(user);
      where.departmentId = {
        in: allowedDepartmentIds.length ? allowedDepartmentIds : [-1],
      };
    }

    if (departmentId) {
      where.departmentId = Number(departmentId);
    }

    if (status) {
      where.status = status;
    }

    const prismaQuery = {
      take,
      skip,
      where,
      include: {
        department: true,
        student: true,
      },
    };
    const [studentOnDepartment, total] = await Promise.all([
      this.prismaService.studentOnDepartment.findMany(prismaQuery),
      this.prismaService.studentOnDepartment.count({ where }),
    ]);
    return createPaginatedResponse<StudentOnDepartment>(
      studentOnDepartment,
      total,
      page,
      size,
    );
  }

  async findOne(id: number, user: any) {
    const record = await this.prismaService.studentOnDepartment.findFirst({
      where: {
        id,
      },
      include: {
        department: true,
        student: true,
      },
    });

    if (!record) {
      throw new BadRequestException('Scholarship request not found');
    }

    // Verify user has access to this department
    if (user.role.name !== 'Admin') {
      const allowedDepartmentIds = this.getAllowedDepartmentIds(user);
      if (!allowedDepartmentIds.includes(record.departmentId)) {
        throw new BadRequestException(
          'You do not have access to this scholarship request',
        );
      }
    }

    return record;
  }

  async update(
    id: number,
    data: UpdateScholarshipRequestDto,
    user: any,
  ): Promise<StudentOnDepartment> {
    const record = await this.findOne(id, user);
    await this.checkDepartmentAccess(record.departmentId, user);

    const nextDepartmentId = data.departmentId ?? record.departmentId;
    if (nextDepartmentId !== record.departmentId) {
      await this.checkDepartmentAccess(nextDepartmentId, user);
    }

    const previousStatus = record.status;

    const updated = await this.prismaService.studentOnDepartment.update({
      where: {
        id,
      },
      data: {
        status: data.status,
        departmentId: nextDepartmentId,
      },
    });

    if (data.status && data.status !== previousStatus) {
      const studentEmail = record.student?.email;
      if (studentEmail) {
        const readableStatus =
          data.status === 'APPROVED' ? 'aprobada' : 'rechazada';
        const subject = `Solicitud de horas beca ${readableStatus}`;
        const text = [
          `Hola ${record.student?.name ?? 'estudiante'},`,
          `Tu solicitud de horas beca fue ${readableStatus}.`,
          `Departamento: ${record.department?.name ?? record.departmentId}.`,
          `Estado: ${data.status}.`,
        ].join('\n');

        await this.mailerService.sendMail({
          to: studentEmail,
          subject,
          text,
        });
      }
    }

    return updated;
  }
}
