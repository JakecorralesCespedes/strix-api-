import { Injectable, ForbiddenException } from '@nestjs/common';
import { WorkHours } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
  createPaginationMetadata,
} from '../utils/pagination.util';
import { GetWorkHoursDto } from './dto/get-work-hours.dto';

@Injectable()
export class WorkHoursService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
