
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    User,
    CreateUserDto,
    UpdateUserDto,
    UserListQuery,
    Role,
    ActiveSessionResponse
} from '@/types/user';
import { MessageResponse } from '@/types/auth';

/**
 * User API Service
 * Handles all user-related API calls
 */
export const userService = {
    /**
     * List all users with pagination and filters
     * GET /v1/users
     */
    async getUsers(params?: UserListQuery): Promise<ApiResponse<User[]>> {
        const response = await axiosInstance.get<ApiResponse<User[]>>('/users', { params });
        return response.data;
    },

    /**
     * Get user by ID
     * GET /v1/users/{id}
     */
    async getUser(id: number): Promise<User> {
        const response = await axiosInstance.get<ApiResponse<User>>(`/users/${id}`);
        return response.data.data;
    },

    /**
     * Create new user
     * POST /v1/users
     */
    async createUser(data: CreateUserDto): Promise<User> {
        const response = await axiosInstance.post<ApiResponse<User>>('/users', data);
        return response.data.data;
    },

    /**
     * Update user
     * PUT /v1/users/{id}
     */
    async updateUser(id: number, data: UpdateUserDto): Promise<User> {
        const response = await axiosInstance.put<ApiResponse<User>>(`/users/${id}`, data);
        return response.data.data;
    },

    /**
     * Deactivate user (soft delete)
     * DELETE /v1/users/{id}
     */
    async deleteUser(id: number): Promise<void> {
        await axiosInstance.delete(`/users/${id}`);
    },

    /**
     * Get all roles
     * GET /v1/users/roles
     */
    async getRoles(): Promise<Role[]> {
        const response = await axiosInstance.get<ApiResponse<Role[]>>('/users/roles');
        return response.data.data;
    },

    /**
     * Get current user profile (alternative to useCurrentUser if fresh data needed)
     * GET /v1/users/me
     */
    async getMe(): Promise<User> {
        const response = await axiosInstance.get<ApiResponse<User>>('/users/me');
        return response.data.data;
    },

    /**
     * Update own profile
     * PUT /v1/users/me
     */
    async updateMe(data: Partial<UpdateUserDto>): Promise<User> {
        const response = await axiosInstance.put<ApiResponse<User>>('/users/me', data);
        return response.data.data;
    },

    /**
     * Get active user sessions (admin only)
     * GET /v1/users/active-sessions
     */
    async getActiveSessions(): Promise<ActiveSessionResponse> {
        const response = await axiosInstance.get<ApiResponse<ActiveSessionResponse>>('/users/active-sessions');
        return response.data.data;
    },

    /**
     * Reset user password (admin only)
     * POST /v1/users/{id}/reset-password
     */
    async resetUserPassword(userId: number, newPassword: string): Promise<MessageResponse> {
        const response = await axiosInstance.post<ApiResponse<MessageResponse>>(`/users/${userId}/reset-password`, {
            newPassword
        });
        return response.data.data;
    },
};
