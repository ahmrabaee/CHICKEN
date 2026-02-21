import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PAGE_ACCESS_KEY = 'requirePageAccess';

/**
 * Decorator to require page access for non-admin users.
 * Admin always passes. Accountant/cashier must have the given path in allowedPages (or '*').
 * Example: @RequirePageAccess('/debts') or @RequirePageAccess('/expenses')
 */
export const RequirePageAccess = (path: string) =>
  SetMetadata(REQUIRE_PAGE_ACCESS_KEY, path);
