import axiosInstance from '@/lib/axios';
import {
    LoginDto,
    LoginResponse,
    RefreshTokenDto,
    RefreshResponse,
    ChangePasswordDto,
    MessageResponse,
    CheckSetupResponse,
    CompleteSetupDto,
} from '@/types/auth';
import { ApiResponse } from '@/types/api';

/**
 * Auth API Service
 * Handles all authentication-related API calls
 */
export const authService = {
    /**
     * Login with username and password
     * POST /v1/auth/login
     */
    async login(credentials: LoginDto): Promise<LoginResponse> {
        const response = await axiosInstance.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
        return response.data.data;
    },

    /**
     * Logout and invalidate session
     * POST /v1/auth/logout
     */
    async logout(): Promise<MessageResponse> {
        const response = await axiosInstance.post<ApiResponse<MessageResponse>>('/auth/logout');
        return response.data.data;
    },

    /**
     * Refresh access token using refresh token
     * POST /v1/auth/refresh
     */
    async refreshToken(data: RefreshTokenDto): Promise<RefreshResponse> {
        const response = await axiosInstance.post<ApiResponse<RefreshResponse>>('/auth/refresh', data);
        return response.data.data;
    },

    /**
     * Change current user password
     * POST /v1/auth/change-password
     */
    async changePassword(data: ChangePasswordDto): Promise<MessageResponse> {
        const response = await axiosInstance.post<ApiResponse<MessageResponse>>('/auth/change-password', data);
        return response.data.data;
    },
    /**
     * Check if initial setup is complete
     * POST /v1/auth/check-setup
     */
    async checkSetup(): Promise<CheckSetupResponse> {
        const response = await axiosInstance.post<ApiResponse<CheckSetupResponse>>('/auth/check-setup');
        return response.data.data;
    },

    /**
     * Complete initial system setup
     * POST /v1/auth/setup
     */
    async completeSetup(data: CompleteSetupDto): Promise<LoginResponse> {
        const response = await axiosInstance.post<ApiResponse<LoginResponse>>('/auth/setup', data);
        return response.data.data;
    },
};
