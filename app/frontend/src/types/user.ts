
import { PaginationMeta } from './api';

export interface Role {
    id: number;
    name: string;
    description?: string;
}

export interface User {
    id: number;
    username: string;
    fullName: string;
    fullNameEn?: string;
    phone?: string;
    preferredLanguage: string;
    defaultBranchId?: number;
    isActive: boolean;
    roles: string[];
    createdAt: string;
    lastLoginAt?: string;
}

export interface CreateUserDto {
    username: string;
    password?: string; // Optional if we generate it or set it later, though backend expects it
    fullName: string;
    fullNameEn?: string;
    phone?: string;
    roleId: number;
    defaultBranchId?: number;
    preferredLanguage?: string;
}

export interface UpdateUserDto extends Partial<CreateUserDto> {
    isActive?: boolean;
}

export interface UserListQuery {
    isActive?: boolean;
    roleId?: number;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface ActiveSession {
    userId: number;
    username: string;
    fullName: string;
    lastLoginAt?: string;
    sessionExpiresAt: string;
}

export interface ActiveSessionResponse {
    activeCount: number;
    users: ActiveSession[];
}
