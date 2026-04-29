import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDepartmentPriceDto } from './dto/create-department-price.dto';
import { UpdateDepartmentPriceDto } from './dto/update-department-price.dto';
import { DepartmentPrice } from '@prisma/client';

@Injectable()
export class DepartmentPricesService {
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

  private ensureCanAccessDepartment(departmentId: number, user: any) {
    if (user?.role?.name === 'Admin') return;
    const allowed = this.getAllowedDepartmentIds(user);
    if (!allowed.includes(departmentId)) {
      throw new BadRequestException(
        'No tienes acceso a este departamento',
      );
    }
  }

  async findAll(user: any, departmentId?: number): Promise<DepartmentPrice[]> {
    const where: any = {};

    if (typeof departmentId === 'number' && !Number.isNaN(departmentId)) {
      this.ensureCanAccessDepartment(departmentId, user);
      where.departmentId = departmentId;
    } else if (user?.role?.name !== 'Admin') {
      const allowed = this.getAllowedDepartmentIds(user);
      where.departmentId = {
        in: allowed.length ? allowed : [-1],
      };
    }

    return this.prismaService.departmentPrice.findMany({
      where,
      orderBy: [{ departmentId: 'asc' }, { id: 'asc' }],
    });
  }

  async create(
    data: CreateDepartmentPriceDto,
    user: any,
  ): Promise<DepartmentPrice> {
    this.ensureCanAccessDepartment(data.departmentId, user);

    const department = await this.prismaService.department.findUnique({
      where: { id: data.departmentId },
    });
    if (!department) {
      throw new BadRequestException('Departamento no encontrado');
    }

    if (typeof data.price !== 'number' || data.price < 0) {
      throw new BadRequestException('El precio debe ser un número positivo');
    }
    if (!data.label?.trim()) {
      throw new BadRequestException('La etiqueta es requerida');
    }

    return this.prismaService.departmentPrice.create({
      data: {
        departmentId: data.departmentId,
        label: data.label.trim(),
        price: data.price,
        active: data.active ?? true,
      },
    });
  }

  async update(
    id: number,
    data: UpdateDepartmentPriceDto,
    user: any,
  ): Promise<DepartmentPrice> {
    const existing = await this.prismaService.departmentPrice.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('Precio no encontrado');
    }

    this.ensureCanAccessDepartment(existing.departmentId, user);

    if (data.departmentId && data.departmentId !== existing.departmentId) {
      this.ensureCanAccessDepartment(data.departmentId, user);
    }

    if (data.price !== undefined && (data.price < 0 || Number.isNaN(data.price))) {
      throw new BadRequestException('El precio debe ser un número positivo');
    }

    return this.prismaService.departmentPrice.update({
      where: { id },
      data: {
        label: data.label?.trim() ?? existing.label,
        price: data.price ?? existing.price,
        active: data.active ?? existing.active,
        departmentId: data.departmentId ?? existing.departmentId,
      },
    });
  }

  async remove(id: number, user: any): Promise<DepartmentPrice> {
    const existing = await this.prismaService.departmentPrice.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('Precio no encontrado');
    }
    this.ensureCanAccessDepartment(existing.departmentId, user);

    return this.prismaService.departmentPrice.delete({ where: { id } });
  }
}
