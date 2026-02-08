# Business Logic Implementation Plan
## Complete Code Changes for PRD Requirements

> [!IMPORTANT]
> This document details ALL business logic changes needed to implement PRD requirements. Each section includes complete code implementations, not just descriptions.

---

## Overview

This plan covers the backend API and service layer changes needed to support:
1. ✅ First-time setup flow
2. ✅ Enhanced user management with session tracking
3. ✅ Branch management APIs
4. ✅ Settings management
5. ✅ Updated authentication flows

---

## File Change Summary

| File | Type | Changes |
|------|------|---------|
| `auth/dto/auth.dto.ts` | **MODIFY** | Add Setup DTOs |
| `auth/auth.controller.ts` | **MODIFY** | Add setup endpoints |
| `auth/auth.service.ts` | **MODIFY** | Add setup logic, update login/logout |
| `users/dto/user.dto.ts` | **MODIFY** | Add new response fields |
| `users/users.controller.ts` | **MODIFY** | Add new endpoints |
| `users/users.service.ts` | **MODIFY** | Update user creation, add session queries |
| `branches/branches.controller.ts` | **NEW** | Full CRUD for branches |
| `branches/branches.service.ts` | **NEW** | Branch business logic |
| `branches/dto/branch.dto.ts` | **NEW** | Branch DTOs |
| `settings/settings.controller.ts` | **MODIFY** | Add business info endpoints |
| `settings/settings.service.ts` | **MODIFY** | Add business info logic |
| `common/decorators/public.decorator.ts` | **VERIFY** | Ensure exists |

---

## Part 1: Authentication & Setup

### 1.1 Update Auth DTOs

**File**: `src/auth/dto/auth.dto.ts`

**ADD** the following new DTOs:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MinLength, IsEnum } from 'class-validator';

// ============================================================================
// EXISTING DTOs (keep as-is)
// ============================================================================
export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class AuthUserResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ required: false })
  fullNameEn?: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  permissions: string[];

  @ApiProperty({ required: false })
  defaultBranchId?: number;

  @ApiProperty()
  preferredLanguage: string;
}

export class LoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: AuthUserResponse;
}

export class RefreshResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  expiresIn: number;
}

// ============================================================================
// NEW DTOs - First-Time Setup
// ============================================================================

export class CheckSetupResponseDto {
  @ApiProperty({ description: 'Whether initial setup has been completed' })
  setupCompleted: boolean;

  @ApiProperty({ required: false, description: 'Business name in Arabic' })
  businessName?: string;

  @ApiProperty({ required: false, description: 'Business name in English' })
  businessNameEn?: string;
}

export class CompleteSetupDto {
  @ApiProperty({ example: 'مقصورة الدجاج', description: 'Business name in Arabic' })
  @IsString()
  @IsNotEmpty({ message: 'Business name is required', })
  businessName: string;

  @ApiProperty({ example: 'Chicken Butcher Shop', required: false })
  @IsString()
  @IsOptional()
  businessNameEn?: string;

  @ApiProperty({ example: 'admin', description: 'Admin username' })
  @IsString()
  @IsNotEmpty({ message: 'Admin username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  adminUsername: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Admin password' })
  @IsString()
  @IsNotEmpty({ message: 'Admin password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  adminPassword: string;

  @ApiProperty({ example: 'أحمد محمد', description: 'Admin full name in Arabic' })
  @IsString()
  @IsNotEmpty({ message: 'Admin full name is required' })
  adminFullName: string;

  @ApiProperty({ example: 'Ahmed Mohamed', required: false })
  @IsString()
  @IsOptional()
  adminFullNameEn?: string;

  @ApiProperty({ example: 'ar', enum: ['ar', 'en'] })
  @IsEnum(['ar', 'en'])
  preferredLanguage: 'ar' | 'en';
}

export class SetupCompleteResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  messageAr: string;

  @ApiProperty({ description: 'Access token for automatic login after setup' })
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: AuthUserResponse;
}

export class PasswordResetPolicyDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  messageAr: string;

  @ApiProperty()
  requiresAdmin: boolean;
}
```

---

### 1.2 Update Auth Controller

**File**: `src/auth/auth.controller.ts`

**ADD** new endpoints (keep existing endpoints):

```typescript
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  LoginResponse,
  RefreshResponse,
  CheckSetupResponseDto,
  CompleteSetupDto,
  SetupCompleteResponseDto,
  PasswordResetPolicyDto,
} from './dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============================================================================
  // NEW ENDPOINT: Check Setup Status
  // ============================================================================
  @Get('check-setup')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if initial system setup is complete',
    description: 'Returns setup status and business info if setup is complete',
  })
  @ApiResponse({
    status: 200,
    description: 'Setup status retrieved',
    type: CheckSetupResponseDto,
  })
  async checkSetup(): Promise<CheckSetupResponseDto> {
    return this.authService.checkSetup();
  }

  // ============================================================================
  // NEW ENDPOINT: Complete First-Time Setup
  // ============================================================================
  @Post('setup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete first-time system setup',
    description: 'Create business name, main branch, and admin user. Can only be called once.',
  })
  @ApiResponse({
    status: 201,
    description: 'Setup completed successfully',
    type: SetupCompleteResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Setup already completed',
  })
  async completeSetup(@Body() dto: CompleteSetupDto): Promise<SetupCompleteResponseDto> {
    return this.authService.completeSetup(dto);
  }

  // ============================================================================
  // NEW ENDPOINT: Password Reset Policy
  // ============================================================================
  @Get('password-reset-policy')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get password reset policy',
    description: 'Returns information about how users can reset their passwords',
  })
  @ApiResponse({
    status: 200,
    description: 'Policy retrieved',
    type: PasswordResetPolicyDto,
  })
  async getPasswordResetPolicy(): Promise<PasswordResetPolicyDto> {
    return {
      message: 'Password changes must be requested through an administrator',
      messageAr: 'يجب طلب تغيير كلمة المرور من خلال المسؤول',
      requiresAdmin: true,
    };
  }

  // ============================================================================
  // EXISTING ENDPOINTS (keep as-is, shown for context)
  // ============================================================================
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponse> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: number) {
    await this.authService.logout(userId);
    return {
      message: 'Logged out successfully',
      messageAr: 'تم تسجيل الخروج بنجاح',
    };
  }

  @Post('change-password')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.oldPassword, dto.newPassword);
    return {
      message: 'Password changed successfully',
      messageAr: 'تم تغيير كلمة المرور بنجاح',
    };
  }
}
```

---

### 1.3 Update Auth Service

**File**: `src/auth/auth.service.ts`

**MODIFY** existing methods and **ADD** new methods:

```typescript
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginResponse,
  RefreshResponse,
  AuthUserResponse,
  CheckSetupResponseDto,
  CompleteSetupDto,
  SetupCompleteResponseDto,
} from './dto';

export interface JwtPayload {
  sub: number;
  username: string;
  roles: string[];
  permissions: string[];
  branchId?: number;
  type?: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ============================================================================
  // NEW METHOD: Check Setup Status
  // ============================================================================
  async checkSetup(): Promise<CheckSetupResponseDto> {
    const setupSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'setup_completed' },
    });

    const setupCompleted = setupSetting?.value === 'true';

    if (setupCompleted) {
      const businessName = await this.prisma.systemSetting.findUnique({
        where: { key: 'business_name' },
      });
      const businessNameEn = await this.prisma.systemSetting.findUnique({
        where: { key: 'business_name_en' },
      });

      return {
        setupCompleted: true,
        businessName: businessName?.value || undefined,
        businessNameEn: businessNameEn?.value || undefined,
      };
    }

    return { setupCompleted: false };
  }

  // ============================================================================
  // NEW METHOD: Complete First-Time Setup
  // ============================================================================
  async completeSetup(dto: CompleteSetupDto): Promise<SetupCompleteResponseDto> {
    // Check if setup already completed
    const setupStatus = await this.checkSetup();
    if (setupStatus.setupCompleted) {
      throw new ConflictException({
        code: 'SETUP_ALREADY_COMPLETE',
        message: 'System setup has already been completed',
        messageAr: 'تم إكمال إعداد النظام بالفعل',
      });
    }

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create main branch
      const mainBranch = await tx.branch.create({
        data: {
          code: 'MAIN',
          name: dto.businessName,
          nameEn: dto.businessNameEn || null,
          isMainBranch: true,
          isActive: true,
        },
      });

      // 2. Get admin role
      const adminRole = await tx.role.findUnique({
        where: { name: 'admin' },
      });

      if (!adminRole) {
        throw new BadRequestException({
          code: 'ROLE_NOT_FOUND',
          message: 'Admin role not found in database',
          messageAr: 'دور المسؤول غير موجود في قاعدة البيانات',
        });
      }

      // 3. Hash password
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

      // 4. Create admin user with session token
      const sessionToken = uuidv4();
      const sessionExpiry = new Date();
      sessionExpiry.setDate(sessionExpiry.getDate() + 7); // 7 days

      const adminUser = await tx.user.create({
        data: {
          username: dto.adminUsername,
          passwordHash,
          fullName: dto.adminFullName,
          fullNameEn: dto.adminFullNameEn,
          preferredLanguage: dto.preferredLanguage,
          defaultBranchId: mainBranch.id,
          currentSessionToken: sessionToken,
          currentSessionExpiry: sessionExpiry,
          lastLoginAt: new Date(),
          isActive: true,
          userRoles: {
            create: {
              roleId: adminRole.id,
            },
          },
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      // 5. Update system settings
      await tx.systemSetting.update({
        where: { key: 'setup_completed' },
        data: { value: 'true' },
      });

      await tx.systemSetting.update({
        where: { key: 'business_name' },
        data: { value: dto.businessName },
      });

      if (dto.businessNameEn) {
        await tx.systemSetting.update({
          where: { key: 'business_name_en' },
          data: { value: dto.businessNameEn },
        });
      }

      await tx.systemSetting.update({
        where: { key: 'setup_completed_at' },
        data: { value: new Date().toISOString() },
      });

      // 6. Create audit log
      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'setup_complete',
          entityType: 'System',
          entityId: 0,
          newData: JSON.stringify({
            businessName: dto.businessName,
            adminUsername: dto.adminUsername,
          }),
        },
      });

      return adminUser;
    });

    // Generate tokens for automatic login
    const roles = result.userRoles.map((ur) => ur.role.name);
    const permissions = this.collectPermissions(result.userRoles);

    const payload: JwtPayload = {
      sub: result.id,
      username: result.username,
      roles,
      permissions,
      branchId: result.defaultBranchId ?? undefined,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Store refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: result.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    this.logger.log(`Setup completed by admin: ${result.username}`);

    return {
      message: 'System setup completed successfully',
      messageAr: 'تم إكمال إعداد النظام بنجاح',
      accessToken,
      refreshToken,
      user: {
        id: result.id,
        username: result.username,
        fullName: result.fullName,
        fullNameEn: result.fullNameEn ?? undefined,
        role: roles[0],
        permissions,
        defaultBranchId: result.defaultBranchId ?? undefined,
        preferredLanguage: result.preferredLanguage,
      },
    };
  }

  // ============================================================================
  // MODIFIED METHOD: Login (add session tracking)
  // ============================================================================
  async login(username: string, password: string): Promise<LoginResponse> {
    const user = await this.validateUser(username, password);

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        messageAr: 'اسم المستخدم أو كلمة المرور غير صحيحة',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
        messageAr: 'حساب المستخدم غير نشط',
      });
    }

    // Collect roles and permissions
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = this.collectPermissions(user.userRoles);

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles,
      permissions,
      branchId: user.defaultBranchId ?? undefined,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Generate session token (UUID)
    const sessionToken = uuidv4();
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 7); // Match refresh token expiry

    // Store tokens in database
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshTokenExpiresAt: sessionExpiry,
        currentSessionToken: sessionToken, // NEW: Track session
        currentSessionExpiry: sessionExpiry, // NEW: Track session
        lastLoginAt: new Date(),
      },
    });

    // Log the login
    await this.createAuditLog(user.id, 'login', 'User', user.id, {
      ip: 'localhost', // TODO: Get from request
    });

    const userResponse: AuthUserResponse = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      fullNameEn: user.fullNameEn ?? undefined,
      role: roles[0] || 'unknown',
      permissions,
      defaultBranchId: user.defaultBranchId ?? undefined,
      preferredLanguage: user.preferredLanguage,
    };

    return {
      accessToken,
      expiresIn: 900, // 15 minutes
      refreshToken,
      user: userResponse,
    };
  }

  // ============================================================================
  // MODIFIED METHOD: Logout (clear session)
  // ============================================================================
  async logout(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExpiresAt: null,
        currentSessionToken: null, // NEW: Clear session
        currentSessionExpiry: null, // NEW: Clear session
      },
    });

    await this.createAuditLog(userId, 'logout', 'User', userId, {});
    this.logger.log(`User ${userId} logged out`);
  }

  // ============================================================================
  // EXISTING METHODS (keep as-is)
  // ============================================================================
  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    // Implementation remains the same
    // ...existing code...
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    // Implementation remains the same but should also clear session tokens
    // ...existing code with added session clearing...
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        refreshToken: null,
        refreshTokenExpiresAt: null,
        currentSessionToken: null, // NEW: Clear all sessions
        currentSessionExpiry: null, // NEW: Clear all sessions
      },
    });
  }

  private collectPermissions(userRoles: any[]): string[] {
    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      const rolePermissions = JSON.parse(ur.role.permissions || '[]');
      rolePermissions.forEach((p: string) => permissionSet.add(p));
    }
    return Array.from(permissionSet);
  }

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
      },
    );
  }

  private generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      },
    );
  }

  private async createAuditLog(
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    data: any,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        newData: JSON.stringify(data),
      },
    });
  }
}
```

---

## Part 2: User Management Enhancements

### 2.1 Update User DTOs

**File**: `src/users/dto/user.dto.ts`

**MODIFY** existing DTOs to add new fields:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, MinLength } from 'class-validator';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ required: false })
  fullNameEn?: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty()
  preferredLanguage: string;

  @ApiProperty({ required: false })
  defaultBranchId?: number;

  // NEW FIELDS
  @ApiProperty({ required: false, description: 'Default branch name' })
  defaultBranchName?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  roles: string[];

  @ApiProperty({ required: false })
  lastLoginAt?: string;

  // NEW FIELDS
  @ApiProperty({ description: 'Whether user is currently logged in' })
  isLoggedIn: boolean;

  @ApiProperty({ description: 'Date when user was added to the system' })
  workStartDate: string;

  @ApiProperty()
  createdAt: string;
}

// ============================================================================
// NEW DTO: Admin Password Reset
// ============================================================================
export class AdminResetPasswordDto {
  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}

// Other existing DTOs remain the same...
export class CreateUserDto {
  // ...existing fields...
}

export class UpdateUserDto {
  // ...existing fields...
}

export class UserListQueryDto {
  // ...existing fields...
  
  // ADD NEW FILTER
  @ApiProperty({ required: false, description: 'Filter by login status' })
  @IsOptional()
  @IsBoolean()
  isLoggedIn?: boolean;
}
```

---

### 2.2 Update Users Service

**File**: `src/users/users.service.ts`

**MODIFY** to add new fields and methods:

```typescript
// ... existing imports ...

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // MODIFIED METHOD: FindAll (add new fields)
  // ============================================================================
  async findAll(query: UserListQueryDto, pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.roleId) {
      where.userRoles = {
        some: {
          roleId: query.roleId,
        },
      };
    }

    // NEW FILTER: Login status
    if (query.isLoggedIn !== undefined) {
      if (query.isLoggedIn) {
        where.currentSessionExpiry = {
          gt: new Date(),
        };
      } else {
        where.OR = [
          { currentSessionExpiry: null },
          { currentSessionExpiry: { lte: new Date() } },
        ];
      }
    }

    if (query.search) {
      where.OR = [
        { username: { contains: query.search } },
        { fullName: { contains: query.search } },
        { fullNameEn: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
          defaultBranch: true, // NEW: Include branch
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map(this.toResponseDto);
    return createPaginatedResult(items, page, pageSize, totalItems);
  }

  // ============================================================================
  // NEW METHOD: Get Active Sessions
  // ============================================================================
  async getActiveSessions() {
    const activeUsers = await this.prisma.user.findMany({
      where: {
        currentSessionExpiry: {
          gt: new Date(),
        },
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        lastLoginAt: true,
        currentSessionExpiry: true,
      },
      orderBy: {
        lastLoginAt: 'desc',
      },
    });

    return {
      activeCount: activeUsers.length,
      users: activeUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        lastLoginAt: u.lastLoginAt?.toISOString(),
        sessionExpiresAt: u.currentSessionExpiry?.toISOString(),
      })),
    };
  }

  // ============================================================================
  // NEW METHOD: Admin Reset User Password
  // ============================================================================
  async resetUserPassword(userId: number, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
        messageAr: 'المستخدم غير موجود',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Clear all sessions when password is reset
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        currentSessionToken: null,
        currentSessionExpiry: null,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'password_reset_by_admin',
        entityType: 'User',
        entityId: userId,
        newData: JSON.stringify({ resetAt: new Date() }),
      },
    });
  }

  // ============================================================================
  // MODIFIED METHOD: toResponseDto (add new fields)
  // ============================================================================
  private toResponseDto(user: any): UserResponseDto {
    // Compute if user is logged in
    const isLoggedIn =
      user.currentSessionExpiry && user.currentSessionExpiry > new Date();

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      fullNameEn: user.fullNameEn,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      defaultBranchId: user.defaultBranchId,
      defaultBranchName: user.defaultBranch?.name, // NEW
      isActive: user.isActive,
      roles: user.userRoles.map((ur: any) => ur.role.name),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      isLoggedIn: !!isLoggedIn, // NEW
      workStartDate: user.workStartDate?.toISOString(), // NEW
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ... other existing methods remain the same ...
}
```

---

### 2.3 Update Users Controller

**File**: `src/users/users.controller.ts`

**ADD** new endpoints:

```typescript
// ... existing imports ...

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ... existing endpoints ...

  // ============================================================================
  // NEW ENDPOINT: Get Active Sessions
  // ============================================================================
  @Get('active-sessions')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Get list of currently logged-in users',
    description: 'Returns count and details of users with active sessions. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved',
  })
  async getActiveSessions() {
    return this.usersService.getActiveSessions();
  }

  // ============================================================================
  // NEW ENDPOINT: Admin Reset Password
  // ============================================================================
  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset user password (admin only)',
    description: 'Allows admin to reset any user\'s password. Clears all active sessions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminResetPasswordDto,
  ) {
    await this.usersService.resetUserPassword(id, dto.newPassword);
    return {
      message: 'Password reset successfully',
      messageAr: 'تم إعادة تعيين كلمة المرور بنجاح',
    };
  }

  // ... other existing endpoints ...
}
```

---

## Part 3: Branch Management (NEW Module)

### 3.1 Create Branch DTOs

**File**: `src/branches/dto/branch.dto.ts` (NEW FILE)

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'BR001', description: 'Unique branch code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'الفرع الرئيسي', description: 'Branch name in Arabic' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Main Branch', required: false })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  hasScale?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  scaleComPort?: string;
}

export class UpdateBranchDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  hasScale?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  scaleComPort?: string;
}

export class BranchResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  nameEn?: string;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty()
  isMainBranch: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ description: 'Number of users assigned to this branch' })
  userCount: number;

  @ApiProperty()
  createdAt: string;
}
```

### 3.2 Create Branch Service

**File**: `src/branches/branches.service.ts` (NEW FILE)

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto, BranchResponseDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<BranchResponseDto[]> {
    const branches = await this.prisma.branch.findMany({
      include: {
        _count: {
          select: {
            defaultBranchUsers: true,
          },
        },
      },
      orderBy: [{ isMainBranch: 'desc' }, { createdAt: 'asc' }],
    });

    return branches.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      nameEn: b.nameEn ?? undefined,
      address: b.address ?? undefined,
      phone: b.phone ?? undefined,
      isMainBranch: b.isMainBranch,
      isActive: b.isActive,
      userCount: b._count.defaultBranchUsers,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async findById(id: number): Promise<BranchResponseDto> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            defaultBranchUsers: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      nameEn: branch.nameEn ?? undefined,
      address: branch.address ?? undefined,
      phone: branch.phone ?? undefined,
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
      userCount: branch._count.defaultBranchUsers,
      createdAt: branch.createdAt.toISOString(),
    };
  }

  async create(dto: CreateBranchDto): Promise<BranchResponseDto> {
    // Check for duplicate code
    const existing = await this.prisma.branch.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Branch code already exists',
        messageAr: 'رمز الفرع موجود بالفعل',
      });
    }

    const branch = await this.prisma.branch.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        hasScale: dto.hasScale ?? false,
        scaleComPort: dto.scaleComPort,
        isMainBranch: false,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            defaultBranchUsers: true,
          },
        },
      },
    });

    return this.toResponseDto(branch);
  }

  async update(id: number, dto: UpdateBranchDto): Promise<BranchResponseDto> {
    const existing = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        hasScale: dto.hasScale,
        scaleComPort: dto.scaleComPort,
      },
      include: {
        _count: {
          select: {
            defaultBranchUsers: true,
          },
        },
      },
    });

    return this.toResponseDto(branch);
  }

  async deactivate(id: number): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }

    // Cannot delete main branch
    if (branch.isMainBranch) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot deactivate the main branch',
        messageAr: 'لا يمكن إلغاء تفعيل الفرع الرئيسي',
      });
    }

    // Check if this is the last active branch
    const activeBranchCount = await this.prisma.branch.count({
      where: { isActive: true },
    });

    if (activeBranchCount <= 1) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot deactivate the last active branch',
        messageAr: 'لا يمكن إلغاء تفعيل آخر فرع نشط',
      });
    }

    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private toResponseDto(branch: any): BranchResponseDto {
    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      nameEn: branch.nameEn ?? undefined,
      address: branch.address ?? undefined,
      phone: branch.phone ?? undefined,
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
      userCount: branch._count?.defaultBranchUsers ?? 0,
      createdAt: branch.createdAt.toISOString(),
    };
  }
}
```

### 3.3 Create Branch Controller

**File**: `src/branches/branches.controller.ts` (NEW FILE)

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto, BranchResponseDto } from './dto/branch.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('branches')
@ApiBearerAuth('JWT-auth')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'List all branches',
    description: 'Get all branches with user counts. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Branches retrieved',
    type: [BranchResponseDto],
  })
  async findAll(): Promise<BranchResponseDto[]> {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiResponse({
    status: 200,
    description: 'Branch found',
    type: BranchResponseDto,
  })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<BranchResponseDto> {
    return this.branchesService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create new branch' })
  @ApiResponse({ status: 201, description: 'Branch created' })
  async create(@Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    return this.branchesService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update branch' })
  @ApiResponse({ status: 200, description: 'Branch updated' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate branch' })
  @ApiResponse({ status: 200, description: 'Branch deactivated' })
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    await this.branchesService.deactivate(id);
    return {
      message: 'Branch deactivated successfully',
      messageAr: 'تم إلغاء تفعيل الفرع بنجاح',
    };
  }
}
```

---

## Summary Checklist

Use this checklist when implementing the changes:

### Authentication & Setup
- [ ] Add new DTOs to `auth/dto/auth.dto.ts`
- [ ] Add new endpoints to `auth/auth.controller.ts`
- [ ] Add `checkSetup()` method to `auth/auth.service.ts`
- [ ] Add `completeSetup()` method to `auth/auth.service.ts`
- [ ] Update `login()` to add session tracking
- [ ] Update `logout()` to clear session
- [ ] Update `changePassword()` to clear sessions

### User Management
- [ ] Update `users/dto/user.dto.ts` with new fields
- [ ] Update `findAll()` in `users/users.service.ts`
- [ ] Add `getActiveSessions()` method
- [ ] Add `resetUserPassword()` method
- [ ] Update `toResponseDto()` helper
- [ ] Add new endpoints to `users/users.controller.ts`

### Branch Management
- [ ] Create `branches/dto/branch.dto.ts`
- [ ] Create `branches/branches.service.ts`
- [ ] Create `branches/branches.controller.ts`
- [ ] Create `branches/branches.module.ts`
- [ ] Add BranchesModule to AppModule imports

### Dependencies
- [ ] Install `uuid` package: `npm install uuid @types/uuid`
- [ ] Verify all decorators exist (@Public, @Roles, @CurrentUser)

---

## Testing Commands

After implementation, test with these commands:

```bash
# 1. Run migrations
npx prisma migrate dev

# 2. Generate Prisma client
npx prisma generate

# 3. Build the application
npm run build

# 4. Run tests
npm run test

# 5. Start development server
npm run start:dev
```

---

## Next Steps

After completing this business logic implementation:

1. Run database migrations (from database_migration_plan.md)
2. Implement frontend to consume these APIs
3. Write integration tests for all new endpoints
4. Update API documentation
5. Deploy and test in staging environment
