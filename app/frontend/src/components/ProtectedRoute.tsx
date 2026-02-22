import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, RefreshCcw, ServerCrash, WifiOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/constants/roles';
import { AccessDenied } from '@/components/AccessDenied';
import { Button } from '@/components/ui/button';

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
    const {
        isAuthenticated,
        user,
        setupStatus,
        setupCompleted,
        setupErrorMessage,
        isLoading,
        refreshSetupStatus,
    } = useAuth();
    const location = useLocation();
    const [isRetryingSetupCheck, setIsRetryingSetupCheck] = useState(false);

    const isSetupStatusUnavailable =
        setupStatus === 'backend_unreachable' || setupStatus === 'backend_error';

    const retrySetupCheck = async () => {
        setIsRetryingSetupCheck(true);
        try {
            await refreshSetupStatus();
        } finally {
            setIsRetryingSetupCheck(false);
        }
    };

    // 1. Wait for setup check to complete
    if (isLoading || setupStatus === 'checking') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    // 2. Backend unavailable: show retry screen instead of forcing setup flow
    if (isSetupStatusUnavailable) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                        {setupStatus === 'backend_unreachable' ? (
                            <WifiOff className="h-6 w-6 text-amber-500" />
                        ) : (
                            <ServerCrash className="h-6 w-6 text-destructive" />
                        )}
                        <h2 className="text-lg font-semibold">
                            {setupStatus === 'backend_unreachable' ? 'تعذر الاتصال بالخادم' : 'الخادم غير جاهز حالياً'}
                        </h2>
                    </div>
                    <p className="mb-5 text-sm text-muted-foreground">
                        {setupErrorMessage || 'لا يمكن التحقق من حالة الإعداد الآن. أعد المحاولة بعد تشغيل الخادم.'}
                    </p>
                    <Button
                        type="button"
                        onClick={retrySetupCheck}
                        disabled={isRetryingSetupCheck}
                        className="w-full gap-2"
                    >
                        {isRetryingSetupCheck ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                جاري إعادة المحاولة...
                            </>
                        ) : (
                            <>
                                <RefreshCcw className="h-4 w-4" />
                                إعادة المحاولة
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    // 3. Redirect to setup if system not initialized
    if (!setupCompleted && location.pathname !== '/setup') {
        return <Navigate to="/setup" replace />;
    }

    // 4. Prevent going to setup if already initialized
    if (setupCompleted && location.pathname === '/setup') {
        return <Navigate to="/" replace />;
    }

    // 5. Authenticated routes logic
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
