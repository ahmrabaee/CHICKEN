import { useLocation, Outlet } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { AccessDenied } from '@/components/AccessDenied';

/**
 * Gate that checks dynamic page access for the current path.
 * Renders AccessDenied when user lacks permission.
 * Admin and paths in allowedPages are permitted.
 */
export function PageAccessGate() {
  const location = useLocation();
  const { canAccessPath } = useRole();

  if (!canAccessPath(location.pathname)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
