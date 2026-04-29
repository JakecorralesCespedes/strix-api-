import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../auth/auth.middleware';

import { SetMetadata } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../common/prisma.service';

type RequestWithUser = FastifyRequest & {
  raw?: AuthenticatedRequest;
  firebaseUser?: AuthenticatedRequest['firebaseUser'];
  user?: any;
  params?: { departmentId?: string | number };
  body?: { departmentId?: string | number };
  query?: { departmentId?: string | number };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly _reflector: Reflector,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles: string[] = this._reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!roles) {
      return false;
    }
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const firebaseUser = request.raw?.firebaseUser ?? request.firebaseUser;
    let user = request.user;

    if (!user && firebaseUser?.uid) {
      user = await this.prismaService.user.findFirst({
        where: { uuid: firebaseUser.uid },
        include: {
          role: true,
          department: true,
          departmentRoles: { include: { role: true, department: true } },
        },
      });
      if (user) {
        request.user = user;
      }
    }

    if (!user) {
      return false;
    }

    const hasPermission = (permissions: string[]) =>
      roles.some((role) => permissions.includes(role));

    const isAdmin =
      user.role?.name === 'Admin' ||
      (user.departmentRoles ?? []).some((item) => item.role?.name === 'Admin');

    if (isAdmin) {
      return true;
    }

    const departmentId =
      request.params?.departmentId ??
      request.body?.departmentId ??
      request.query?.departmentId;

    const departmentRoles = user.departmentRoles ?? [];

    if (departmentId) {
      const match = departmentRoles.find(
        (item) => item.departmentId === Number(departmentId),
      );
      if (match) {
        return hasPermission(match.role?.allowedPermissions ?? []);
      }

      if (!departmentRoles.length && user.departmentId === Number(departmentId)) {
        return hasPermission(user.role?.allowedPermissions ?? []);
      }

      return false;
    }

    if (departmentRoles.length) {
      return departmentRoles.some((item) =>
        hasPermission(item.role?.allowedPermissions ?? []),
      );
    }

    return hasPermission(user.role?.allowedPermissions ?? []);
  }
}

export function Roles(...roles: string[]) {
  return applyDecorators(SetMetadata('roles', roles), UseGuards(RolesGuard));
}
