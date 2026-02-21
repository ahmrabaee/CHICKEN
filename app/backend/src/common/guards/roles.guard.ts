import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Normalize roles: 'cashier' is legacy alias for 'accountant' */
function normalizeRoles(roles: string[]): string[] {
  if (!roles?.length) return roles ?? [];
  return roles.map((r) => (r === 'cashier' ? 'accountant' : r));
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles specified means any authenticated user can access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Access denied',
        messageAr: 'تم رفض الوصول',
      });
    }

    const normalizedUserRoles = normalizeRoles(user.roles);
    const hasRole = requiredRoles.some((role) => normalizedUserRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        messageAr: 'صلاحيات غير كافية',
      });
    }

    return true;
  }
}
