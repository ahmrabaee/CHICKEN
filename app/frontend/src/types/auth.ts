// Auth-related TypeScript interfaces based on backend Swagger API

export interface LoginDto {
    username: string;
    password: string;
}

export interface AuthUserResponse {
    id: number;
    username: string;
    fullName: string;
    fullNameEn?: string;
    role: string;
    permissions: string[];
    defaultBranchId?: number;
    preferredLanguage: string;
    /** Allowed page paths; ['*'] for admin; paths for accountant */
    allowedPages?: string[];
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // Token expiration time in seconds (900 = 15 minutes)
    user: AuthUserResponse;
}

export interface RefreshTokenDto {
    refreshToken?: string;
}

export interface RefreshResponse {
    accessToken: string;
    expiresIn: number;
}

export interface ChangePasswordDto {
    currentPassword: string;  // Backend ACTUALLY uses 'currentPassword' (checked auth.dto.ts line 37)
    newPassword: string;
}

export interface CheckSetupResponse {
    setupCompleted: boolean;
    businessName?: string;
    businessNameEn?: string;
}

export interface CompleteSetupDto {
    businessName: string;
    businessNameEn?: string;
    adminUsername: string;
    adminPassword: string;
    adminFullName: string;
    adminFullNameEn?: string;
    preferredLanguage: 'ar' | 'en';
}

export interface MessageResponse {
    message: string;
    messageAr?: string;
}
