import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { normalizeRole } from '@/constants/roles';
import { AccessDenied } from '@/components/AccessDenied';

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

/**
 * ProtectedRoute component
 * Redirects to setup if system is not initialized
 * Redirects to login if user is not authenticated
 * Redirects to home if user doesn't have required roles
 */
export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { isAuthenticated, user, setupCompleted, isLoading } = useAuth();
    const location = useLocation();

    // 1. Wait for setup check to complete
    if (isLoading || setupCompleted === null) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    // 2. Redirect to setup if system not initialized
    if (!setupCompleted && location.pathname !== '/setup') {
        return <Navigate to="/setup" replace />;
    }

    // 3. Prevent going to setup if already initialized
    if (setupCompleted && location.pathname === '/setup') {
        return <Navigate to="/" replace />;
    }

    // 4. Authenticated routes logic
    if (location.pathname !== '/setup') {
        if (!isAuthenticated) {
            return <Navigate to="/login" replace state={{ from: location }} />;
        }

        if (allowedRoles && user) {
            const effectiveRole = normalizeRole(user.role);
            if (!allowedRoles.includes(user.role) && !allowedRoles.includes(effectiveRole || '')) {
                return <AccessDenied />;
            }
        }
    }

    return <Outlet />;
};
