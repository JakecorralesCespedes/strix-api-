import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DepartmentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const firebaseUser = request.firebaseUser ?? request.raw?.firebaseUser;

    if (!firebaseUser) {
      throw new ForbiddenException('No authenticated user');
    }

    // Find user in database
    const user = await this.prisma.user.findFirst({
      where: { uuid: firebaseUser.uid },
      include: {
        role: true,
        department: true,
        departmentRoles: {
          include: { role: true, department: true },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found in database');
    }

    // Attach user to request for later use
    request.user = user;

    // Check if user is Admin (can access all departments)
    if (user.role.name === 'Admin') {
      return true;
    }

    // For non-admins, check if they can access the requested department
    const departmentId =
      request.params?.departmentId ??
      request.body?.departmentId ??
      request.query?.departmentId;

    const allowedDepartmentIds = (user.departmentRoles ?? []).map(
      (item) => item.departmentId,
    );
    if (!allowedDepartmentIds.length && user.departmentId) {
      allowedDepartmentIds.push(user.departmentId);
    }
    request.allowedDepartmentIds = allowedDepartmentIds;

    if (
      departmentId &&
      !allowedDepartmentIds.includes(Number(departmentId))
    ) {
      throw new ForbiddenException(
        `You can only access departments ${allowedDepartmentIds.join(', ')}`,
      );
    }

    return true;
  }
}
