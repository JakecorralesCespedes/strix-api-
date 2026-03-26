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

@Injectable()
export class ScholarshipRequestService {
  constructor(private readonly prismaService: PrismaService) {}

  private async checkDepartmentAccess(departmentId: number, user: any) {
    if (user.role.name === 'Admin') return;

    if (user.departmentId !== departmentId) {
      throw new BadRequestException(
        `You can only manage scholarship requests for department ${user.departmentId}`,
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
      where.departmentId = user.departmentId;
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
    if (user.role.name !== 'Admin' && record.departmentId !== user.departmentId) {
      throw new BadRequestException(
        'You do not have access to this scholarship request',
      );
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

    return this.prismaService.studentOnDepartment.update({
      where: {
        id,
      },
      data: {
        status: data.status,
      },
    });
  }
}
