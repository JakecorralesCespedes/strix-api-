import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateDepartamentDto } from './dto/create-departament.dto';
import { UpdateDepartamentDto } from './dto/update-departament.dto';
import { Department } from '@prisma/client';
import { GetDepartamentDto } from './dto/get-departament.dto';
import { PrismaService } from '../common/prisma.service';
import {
  createPaginatedResponse,
  createPaginationMetadata,
  PaginatedResponse,
} from 'src/utils/pagination.util';

@Injectable()
export class DepartamentsService {
  constructor(private readonly prismaService: PrismaService) {}

  private async resolvePricing(
    data: { pricing?: number; pricingId?: number },
    currentDepartmentId?: number,
  ): Promise<number> {
    if (typeof data.pricing === 'number') {
      return data.pricing;
    }

    if (
      typeof data.pricingId !== 'number' &&
      typeof currentDepartmentId === 'number'
    ) {
      const department = await this.prismaService.department.findFirst({
        where: { id: currentDepartmentId },
      });

      if (!department) {
        throw new BadRequestException('Department not found');
      }

      return department.pricing;
    }

    if (typeof data.pricingId !== 'number') {
      throw new BadRequestException('pricing or pricingId is required');
    }

    const pricesConfig = await this.prismaService.globalSetting.findUnique({
      where: { key: 'prices' },
    });

    if (!pricesConfig?.value) {
      throw new BadRequestException('Price list is not configured');
    }

    try {
      const prices = JSON.parse(pricesConfig.value) as Array<{
        id: number;
        price: number;
        active?: boolean;
      }>;
      const current = prices.find((item) => item.id === data.pricingId);

      if (!current) {
        throw new BadRequestException(
          `Price with id ${data.pricingId} does not exist`,
        );
      }

      return current.price;
    } catch {
      throw new BadRequestException('Invalid price list configuration');
    }
  }

  async createDepartamet(data: CreateDepartamentDto): Promise<Department> {
    try {
      const pricing = await this.resolvePricing(data);

      return this.prismaService.department.create({
        data: {
          name: data.name,
          code: data.code,
          pricing,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Could not be created');
    }
  }

  async findAll(
    query: GetDepartamentDto,
  ): Promise<PaginatedResponse<Department>> {
    const { page = 1, size = 10 } = query;
    const { take, skip } = createPaginationMetadata(page, size);
    const prismaQuery = {
      take,
      skip,
      include: {
        users: true,
      },
    };
    const [departament, total] = await Promise.all([
      this.prismaService.department.findMany(prismaQuery),
      this.prismaService.department.count(),
    ]);
    return createPaginatedResponse<Department>(departament, total, page, size);
  }

  findOne(id: number) {
    return this.prismaService.department.findFirst({
      where: {
        id,
      },
    });
  }

  updatedepartament(
    id: number,
    data: UpdateDepartamentDto,
  ): Promise<Department> {
    return this.updateDepartmentWithPricing(id, data);
  }

  private async updateDepartmentWithPricing(
    id: number,
    data: UpdateDepartamentDto,
  ): Promise<Department> {
    const pricing = await this.resolvePricing(data, id);

    return this.prismaService.department.update({
      where: {
        id,
      },
      data: {
        name: data.name,
        code: data.code,
        pricing,
      },
    });
  }
}
