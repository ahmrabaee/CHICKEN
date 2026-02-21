import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { isAuthenticated as checkAuthenticated, getStoredUser, setTokens as saveTokens, clearTokens as removeTokens } from '@/lib/auth';
import { authService } from '@/services/auth.service';
import type { AuthUserResponse } from '@/types/auth';

export type SetupStatus =
    | 'checking'
    | 'setup_complete'
    | 'setup_incomplete'
    | 'backend_unreachable'
    | 'backend_error';

interface AuthContextType {
    user: AuthUserResponse | null;
    isAuthenticated: boolean;
    setupStatus: SetupStatus;
    setupCompleted: boolean | null;
    setupErrorMessage: string | null;
    isLoading: boolean;
    refreshSetupStatus: () => Promise<void>;
    login: (accessToken: string, refreshToken: string, user: AuthUserResponse) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<AuthUserResponse | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [setupStatus, setSetupStatus] = useState<SetupStatus>('checking');
    const [setupErrorMessage, setSetupErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSetup = useCallback(async () => {
        setSetupStatus('checking');
        setSetupErrorMessage(null);

        try {
            const result = await authService.checkSetup();
            setSetupStatus(result.setupCompleted ? 'setup_complete' : 'setup_incomplete');
        } catch (error) {
            console.error('Failed to check setup status:', error);

            const apiStatus = (error as { response?: { status?: number } })?.response?.status;
            const apiMessage = (error as { response?: { data?: { error?: { messageAr?: string; message?: string } } } })?.response?.data?.error;
            const fallbackMessage = (error as { message?: string })?.message || 'Failed to check setup status';
            const message = apiMessage?.messageAr || apiMessage?.message || fallbackMessage;

            if (apiStatus === 503) {
                setSetupStatus('backend_error');
                setSetupErrorMessage(message);
                return;
            }

            if (apiStatus === undefined) {
                setSetupStatus('backend_unreachable');
                setSetupErrorMessage('تعذر الاتصال بالخادم. تأكد من تشغيل السيرفر ثم أعد المحاولة.');
                return;
            }

            setSetupStatus('backend_error');
            setSetupErrorMessage(message);
        }
    }, []);

    const initAuth = useCallback(() => {
        const storedUser = getStoredUser();
        const authenticated = checkAuthenticated();
        setUser(storedUser);
        setIsAuthenticated(authenticated);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            await checkSetup();
            initAuth();
        };
        loadInitialData();
    }, [checkSetup, initAuth]);

    const setupCompleted =
        setupStatus === 'setup_complete'
            ? true
            : setupStatus === 'setup_incomplete'
                ? false
                : null;

    const login = (accessToken: string, refreshToken: string, userData: AuthUserResponse) => {
        saveTokens(accessToken, refreshToken, userData);
        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        removeTokens();
        setUser(null);
        setIsAuthenticated(false);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated,
        setupStatus,
        setupCompleted,
        setupErrorMessage,
        isLoading,
        refreshSetupStatus: checkSetup,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
