import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PAGE_ACCESS_KEY } from '../decorators/require-page-access.decorator';

@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPath = this.reflector.getAllAndOverride<string>(
      REQUIRE_PAGE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPath) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Access denied',
        messageAr: 'تم رفض الوصول',
      });
    }

    // Admin always has access
    const roles = user.roles ?? [];
    if (roles.includes('admin')) {
      return true;
    }

    // Check page access for accountant/cashier
    const allowedPages: string[] = user.allowedPages ?? [];
    if (allowedPages.includes('*')) {
      return true;
    }
    if (allowedPages.includes(requiredPath)) {
      return true;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Insufficient permissions - page access required',
      messageAr: 'صلاحيات غير كافية - يلزم صلاحية الوصول للصفحة',
    });
  }
}
