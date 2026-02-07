import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict route access to specific roles
 * Example: @Roles('admin') or @Roles('admin', 'cashier')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
