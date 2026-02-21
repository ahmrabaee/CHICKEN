import { useAuth } from '@/context/AuthContext';
import { ROLES, isAdminOnlyPath, normalizeRole } from '@/constants/roles';

/**
 * Check if path is allowed by allowedPages array
 * - '*' means all paths
 * - exact match or prefix match (path.startsWith(p + '/'))
 */
function pathAllowed(requestPath: string, allowedPages: string[]): boolean {
  if (allowedPages.includes('*')) return true;
  const normalized = requestPath.endsWith('/') && requestPath.length > 1
    ? requestPath.slice(0, -1)
    : requestPath;
  return allowedPages.some(
    (p) => normalized === p || normalized.startsWith(p + '/'),
  );
}

export function useRole() {
  const { user } = useAuth();
  const role = user?.role;
  const effectiveRole = normalizeRole(role);
  const allowedPages = user?.allowedPages;

  const isAdmin = role === ROLES.ADMIN;
  const isAccountant = effectiveRole === ROLES.ACCOUNTANT;

  const canAccessPath = (path: string): boolean => {
    if (isAdmin) return true;
    if (allowedPages && allowedPages.length > 0) {
      return pathAllowed(path, allowedPages);
    }
    return !isAdminOnlyPath(path);
  };
  const canAccessAdminPages = isAdmin;

  return { role, effectiveRole, isAdmin, isAccountant, canAccessPath, canAccessAdminPages, allowedPages };
}
