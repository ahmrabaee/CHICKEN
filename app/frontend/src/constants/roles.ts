/**
 * Role constants and utilities
 * Admin and Accountant roles per ACCOUNTANT_ADMIN_ROLES_PLAN
 * "cashier" is legacy alias for accountant (backward compat)
 */

export const ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  /** @deprecated Legacy alias for accountant */
  CASHIER: 'cashier',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Normalize role: cashier → accountant for consistency */
export function normalizeRole(role: string | undefined): string | undefined {
  if (!role) return role;
  return role === ROLES.CASHIER ? ROLES.ACCOUNTANT : role;
}

/** Paths restricted to admin only */
export const ADMIN_ONLY_PATHS: string[] = [
  '/settings',
  '/users',
  '/branches',
  '/audit',
  '/traders',
  '/expenses',
  '/debts',
  '/wastage',
  '/purchasing',
  '/reports/financial',
  '/reports/profit-loss',
  '/reports/stock-vs-gl',
  '/reports/tax',
  '/reports/vat',
];

/** Check if path is admin-only */
export function isAdminOnlyPath(path: string): boolean {
  return ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/** Check if user has admin role */
export function isAdmin(role: string | undefined): boolean {
  return role === ROLES.ADMIN;
}

/** Role display labels (Arabic) */
export const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]: 'مدير',
  [ROLES.ACCOUNTANT]: 'محاسب',
  [ROLES.CASHIER]: 'محاسب', // legacy
};
