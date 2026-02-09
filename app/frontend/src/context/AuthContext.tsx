import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { isAuthenticated as checkAuthenticated, getStoredUser, setTokens as saveTokens, clearTokens as removeTokens } from '@/lib/auth';
import { authService } from '@/services/auth.service';
import type { AuthUserResponse } from '@/types/auth';

interface AuthContextType {
    user: AuthUserResponse | null;
    isAuthenticated: boolean;
    setupCompleted: boolean | null;
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
    const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSetup = useCallback(async () => {
        try {
            const result = await authService.checkSetup();
            setSetupCompleted(result.setupCompleted);
        } catch (error) {
            console.error('Failed to check setup status:', error);
            setSetupCompleted(true);
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
        setupCompleted,
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
