import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

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
  @ApiPropertyOptional({
    description: 'Refresh token (optional if sent via cookie)',
  })
  @IsString()
  refreshToken?: string;
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
