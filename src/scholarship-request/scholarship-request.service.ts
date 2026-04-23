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

    // Resolver el estudiante: por studentId, o por upsert desde (code/email/name)
    let studentId = data.studentId;

    if (!studentId) {
      if (!data.code || !data.name || !data.email) {
        throw new BadRequestException(
          'Debes proporcionar studentId o los datos del estudiante (name, email, code)',
        );
      }

      // Buscar por codigo (carnet) o por email; si existe, reutilizar y actualizar datos
      const existingStudent = await this.prismaService.student.findFirst({
        where: {
          OR: [{ code: data.code }, { email: data.email }],
        },
      });

      if (existingStudent) {
        const updatedStudent = await this.prismaService.student.update({
          where: { id: existingStudent.id },
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone ?? existingStudent.phone,
            code: data.code,
          },
        });
        studentId = updatedStudent.id;
      } else {
        const createdStudent = await this.prismaService.student.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone ?? '',
            code: data.code,
          },
        });
        studentId = createdStudent.id;
      }
    } else {
      const student = await this.prismaService.student.findUnique({
        where: { id: studentId },
      });
      if (!student) {
        throw new BadRequestException('Student not found');
      }
    }

    const existing = await this.prismaService.studentOnDepartment.findFirst({
      where: { studentId, departmentId: data.departmentId },
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
            id: studentId,
          },
        },
      },
      include: {
        student: true,
        department: true,
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
          data.status === 'APPROVED'
            ? 'APROBADA'
            : data.status === 'REJECTED'
              ? 'RECHAZADA'
              : 'EN REVISION';
        const subject = `Tu solicitud de horas beca fue ${readableStatus}`;
        const departmentName =
          record.department?.name ?? `#${record.departmentId}`;
        const studentName = record.student?.name ?? 'estudiante';
        const bodyLine =
          data.status === 'APPROVED'
            ? 'Ya puedes comenzar a reportar tus horas a traves del jefe de departamento.'
            : data.status === 'REJECTED'
              ? 'Si crees que fue un error, contacta al departamento responsable.'
              : '';

        const text = [
          `Hola ${studentName},`,
          '',
          `Te informamos que tu solicitud de horas beca para el departamento "${departmentName}" fue ${readableStatus}.`,
          '',
          bodyLine,
          '',
          'Sistema Strix - Gestion de Horas Beca',
        ]
          .filter(Boolean)
          .join('\n');

        const accentColor =
          data.status === 'APPROVED'
            ? '#047857'
            : data.status === 'REJECTED'
              ? '#b91c1c'
              : '#1d4ed8';
        const html = `
          <div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:auto;">
            <h2 style="color:${accentColor};margin-bottom:4px;">Solicitud ${readableStatus}</h2>
            <p>Hola <strong>${escapeHtml(studentName)}</strong>,</p>
            <p>Tu solicitud de horas beca para el departamento <strong>${escapeHtml(departmentName)}</strong> fue <span style="color:${accentColor};font-weight:600;">${readableStatus}</span>.</p>
            ${bodyLine ? `<p>${escapeHtml(bodyLine)}</p>` : ''}
            <p style="margin-top:20px;color:#6b7280;font-size:12px;">Sistema Strix - Gestion de Horas Beca</p>
          </div>`;

        await this.mailerService.sendMail({
          to: studentEmail,
          subject,
          text,
          html,
        });
      }
    }

    return updated;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
