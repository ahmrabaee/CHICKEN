import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Username',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Password',
    example: 'Admin@123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'Admin@123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'NewPassword@123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token to exchange for a new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class AuthUserResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin' })
  username: string;

  @ApiProperty({ example: 'مدير النظام' })
  fullName: string;

  @ApiPropertyOptional({ example: 'System Administrator' })
  fullNameEn?: string;

  @ApiProperty({ example: 'admin' })
  role: string;

  @ApiProperty({ example: ['*'] })
  permissions: string[];

  @ApiPropertyOptional({ example: 1 })
  defaultBranchId?: number;

  @ApiProperty({ example: 'ar' })
  preferredLanguage: string;

  @ApiPropertyOptional({
    description: 'Allowed page paths for non-admin (use ["*"] for admin)',
    example: ['/', '/sales', '/inventory'],
  })
  allowedPages?: string[];
}

export class LoginResponse {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Refresh token for obtaining new access tokens',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Authenticated user information',
    type: AuthUserResponse,
  })
  user: AuthUserResponse;
}

export class RefreshResponse {
  @ApiProperty({
    description: 'New JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
  })
  expiresIn: number;
}

export class MessageResponse {
  @ApiProperty({
    description: 'Success message',
    example: 'Operation completed successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Arabic message',
    example: 'تمت العملية بنجاح',
  })
  messageAr?: string;
}

// ============================================
// First-Time Setup DTOs
// ============================================

export class CheckSetupResponse {
  @ApiProperty({ description: 'Whether initial setup is complete' })
  setupCompleted: boolean;

  @ApiPropertyOptional({ description: 'Business name (if setup complete)' })
  businessName?: string;

  @ApiPropertyOptional({ description: 'Business name in English (if setup complete)' })
  businessNameEn?: string;
}

export class CompleteSetupDto {
  @ApiProperty({ description: 'Business name in Arabic' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiPropertyOptional({ description: 'Business name in English' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString()
  businessNameEn?: string;

  @ApiProperty({ description: 'Admin username', minLength: 3 })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  adminUsername: string;

  @ApiProperty({ description: 'Admin password', minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiProperty({ description: 'Admin full name in Arabic' })
  @IsString()
  @IsNotEmpty()
  adminFullName: string;

  @ApiPropertyOptional({ description: 'Admin full name in English' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString()
  adminFullNameEn?: string;

  @ApiProperty({ description: 'Preferred language', enum: ['ar', 'en'] })
  @IsEnum(['ar', 'en'])
  preferredLanguage: 'ar' | 'en';
}

// ============================================
// Admin Password Reset DTO
// ============================================

export class AdminResetPasswordDto {
  @ApiProperty({ description: 'New password for the user', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
