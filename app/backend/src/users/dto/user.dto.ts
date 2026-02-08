import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  IsPositive,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({
    description: 'Unique username',
    example: 'cashier1',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    example: 'Password@123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Full name in Arabic',
    example: 'أحمد محمد',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    description: 'Full name in English',
    example: 'Ahmed Mohammed',
  })
  @IsString()
  @IsOptional()
  fullNameEn?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'ahmed@example.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+966501234567',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'Role ID (1=Admin, 2=Cashier)',
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  roleId: number;

  @ApiPropertyOptional({
    description: 'Default branch ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  defaultBranchId?: number;

  @ApiPropertyOptional({
    description: 'Preferred language',
    example: 'ar',
    enum: ['ar', 'en'],
  })
  @IsString()
  @IsIn(['ar', 'en'])
  @IsOptional()
  preferredLanguage?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // Password is optional when updating
  @ApiPropertyOptional({
    description: 'New password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @IsOptional()
  declare password?: string;
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'cashier1' })
  username: string;

  @ApiProperty({ example: 'أحمد محمد' })
  fullName: string;

  @ApiPropertyOptional({ example: 'Ahmed Mohammed' })
  fullNameEn?: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  phone?: string;

  @ApiProperty({ example: 'ar' })
  preferredLanguage: string;

  @ApiPropertyOptional({ example: 1 })
  defaultBranchId?: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: ['cashier'] })
  roles: string[];

  @ApiProperty({ example: '2026-02-07T10:30:00Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: '2026-02-07T10:30:00Z' })
  lastLoginAt?: string;

  @ApiPropertyOptional({
    example: '2026-02-07T10:30:00Z',
    description: 'Date when user was added to the system (PRD requirement)',
  })
  workStartDate?: string;

  @ApiProperty({
    example: true,
    description: 'Whether user is currently logged in (PRD requirement)',
  })
  isLoggedIn: boolean;
}

export class UserListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by role ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roleId?: number;

  @ApiPropertyOptional({
    description: 'Search by username or name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
