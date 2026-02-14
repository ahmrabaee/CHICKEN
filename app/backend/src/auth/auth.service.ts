import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginResponse,
  RefreshResponse,
  AuthUserResponse,
  CheckSetupResponse,
  CompleteSetupDto,
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

  /**
   * Validate user credentials
   */
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

  /**
   * Login and generate tokens
   */
  async login(
    username: string,
    password: string,
    ipAddress?: string,
  ): Promise<LoginResponse> {
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

    // Generate session token for tracking active sessions (PRD requirement)
    const sessionToken = randomUUID();
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 7); // 7 days to match refresh token

    // Store refresh token hash AND session token in database
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshTokenExpiresAt: sessionExpiry,
        currentSessionToken: sessionToken,
        currentSessionExpiry: sessionExpiry,
        lastLoginAt: new Date(),
      },
    });

    // Log the login with real IP address
    await this.createAuditLog(user.id, 'login', 'User', user.id, {
      ip: ipAddress || 'unknown',
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

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    // Verify JWT first - this will throw if expired or invalid signature
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh token expired or invalid',
        messageAr: 'انتهت صلاحية رمز التحديث',
      });
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
        messageAr: 'رمز التحديث غير صالح',
      });
    }

    // Find user and verify refresh token
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'User not found or token revoked',
        messageAr: 'المستخدم غير موجود أو الرمز ملغى',
      });
    }

    // Verify refresh token matches stored hash
    const isValidToken = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidToken) {
      throw new UnauthorizedException({
        code: 'TOKEN_MISMATCH',
        message: 'Refresh token has been invalidated (new login detected)',
        messageAr: 'تم إبطال رمز التحديث (تم اكتشاف تسجيل دخول جديد)',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
        messageAr: 'حساب المستخدم غير نشط',
      });
    }

    // Generate new access token
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = this.collectPermissions(user.userRoles);

    const newPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles,
      permissions,
      branchId: user.defaultBranchId ?? undefined,
    };

    const accessToken = this.generateAccessToken(newPayload);

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  /**
   * Logout - invalidate refresh token and session
   */
  async logout(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExpiresAt: null,
        currentSessionToken: null,
        currentSessionExpiry: null,
      },
    });

    await this.createAuditLog(userId, 'logout', 'User', userId, {});
  }

  /**
   * Change password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'NOT_FOUND',
        message: 'User not found',
        messageAr: 'المستخدم غير موجود',
      });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect',
        messageAr: 'كلمة المرور الحالية غير صحيحة',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Clear all sessions to force re-login (security best practice)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        currentSessionToken: null,
        currentSessionExpiry: null,
      },
    });

    await this.createAuditLog(userId, 'update', 'User', userId, {
      action: 'password_changed',
    });
  }

  /**
   * Get user by ID with roles
   */
  async getUserById(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  // Private helper methods

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      },
    );
  }

  private generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { sub: payload.sub, type: 'refresh' },
      {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
  }

  private collectPermissions(
    userRoles: Array<{ role: { permissions: string | null } }>,
  ): string[] {
    const permissionsSet = new Set<string>();
    for (const ur of userRoles) {
      if (!ur.role.permissions) continue;
      try {
        const rolePermissions = JSON.parse(ur.role.permissions) as string[];
        rolePermissions.forEach((p) => permissionsSet.add(p));
      } catch {
        // Skip invalid JSON
      }
    }
    return Array.from(permissionsSet);
  }

  private async createAuditLog(
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    details: Record<string, unknown>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          username: user?.username ?? 'unknown',
          action,
          entityType,
          entityId,
          changes: JSON.stringify(details),
          ipAddress: 'localhost',
          userAgent: 'API',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to create audit log: ${error}`);
    }
  }

  // ============================================
  // First-Time Setup Methods (PRD Requirements)
  // ============================================

  /**
   * Check if initial system setup is complete
   */
  async checkSetup(): Promise<CheckSetupResponse> {
    try {
      const setupCompletedSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'setup_completed' },
      });

      if (!setupCompletedSetting || setupCompletedSetting.value !== 'true') {
        return { setupCompleted: false };
      }

      // Get business names
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
    } catch (err) {
      this.logger.warn('checkSetup failed, assuming not configured', err);
      return { setupCompleted: false };
    }
  }

  /**
   * Complete initial system setup (create business, admin user, main branch)
   */
  async completeSetup(dto: CompleteSetupDto, ipAddress?: string): Promise<LoginResponse> {
    // Verify setup not already complete
    const setupCheck = await this.checkSetup();
    if (setupCheck.setupCompleted) {
      throw new BadRequestException({
        code: 'SETUP_ALREADY_COMPLETE',
        message: 'Initial setup has already been completed',
        messageAr: 'تم إكمال الإعداد الأولي بالفعل',
      });
    }

    // Use transaction for atomicity
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create main branch
      const existingBranch = await tx.branch.findFirst({
        where: { isMainBranch: true },
      });

      let mainBranch = existingBranch;
      if (!mainBranch) {
        mainBranch = await tx.branch.create({
          data: {
            code: 'MAIN',
            name: 'الفرع الرئيسي',
            nameEn: 'Main Branch',
            isMainBranch: true,
            isActive: true,
          },
        });
      }

      // 2. Get admin role (should exist from seed)
      const adminRole = await tx.role.findUnique({
        where: { name: 'admin' },
      });

      if (!adminRole) {
        throw new BadRequestException({
          code: 'ADMIN_ROLE_NOT_FOUND',
          message: 'Admin role not found in database. Please run database seed first.',
          messageAr: 'دور المسؤول غير موجود في قاعدة البيانات. يرجى تشغيل بذرة قاعدة البيانات أولاً.',
        });
      }

      // 3. Check if admin username already exists
      const existingUser = await tx.user.findUnique({
        where: { username: dto.adminUsername },
      });
      if (existingUser) {
        throw new BadRequestException({
          code: 'USERNAME_EXISTS',
          message: 'Username already exists',
          messageAr: 'اسم المستخدم موجود بالفعل',
        });
      }

      // 4. Hash admin password
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

      // 5. Create admin user
      const adminUser = await tx.user.create({
        data: {
          username: dto.adminUsername,
          passwordHash,
          fullName: dto.adminFullName,
          fullNameEn: dto.adminFullNameEn,
          preferredLanguage: dto.preferredLanguage,
          defaultBranchId: mainBranch.id,
          isActive: true,
          workStartDate: new Date(),
        },
      });

      // 6. Assign admin role
      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      // 7. Update system settings
      await tx.systemSetting.updateMany({
        where: { key: 'setup_completed' },
        data: { value: 'true', updatedAt: new Date() },
      });
      await tx.systemSetting.updateMany({
        where: { key: 'business_name' },
        data: { value: dto.businessName, updatedAt: new Date() },
      });
      await tx.systemSetting.updateMany({
        where: { key: 'business_name_en' },
        data: { value: dto.businessNameEn || '', updatedAt: new Date() },
      });
      await tx.systemSetting.updateMany({
        where: { key: 'setup_completed_at' },
        data: { value: new Date().toISOString(), updatedAt: new Date() },
      });

      // 8. Create audit log for setup completion
      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          username: adminUser.username,
          action: 'system_setup_complete',
          entityType: 'System',
          entityId: 0,
          changes: JSON.stringify({ businessName: dto.businessName }),
          ipAddress: ipAddress || 'unknown',
          userAgent: 'Setup Wizard',
        },
      });

      // 9. Auto-login admin user (generate tokens)
      const adminPermissions = this.getAdminPermissions();
      const payload: JwtPayload = {
        sub: adminUser.id,
        username: adminUser.username,
        roles: ['admin'],
        permissions: adminPermissions,
        branchId: mainBranch.id,
      };

      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken(payload);

      // Store tokens and session
      const sessionToken = randomUUID();
      const sessionExpiry = new Date();
      sessionExpiry.setDate(sessionExpiry.getDate() + 7);

      await tx.user.update({
        where: { id: adminUser.id },
        data: {
          refreshToken: await bcrypt.hash(refreshToken, 10),
          refreshTokenExpiresAt: sessionExpiry,
          currentSessionToken: sessionToken,
          currentSessionExpiry: sessionExpiry,
          lastLoginAt: new Date(),
        },
      });

      return {
        accessToken,
        expiresIn: 900,
        refreshToken,
        user: {
          id: adminUser.id,
          username: adminUser.username,
          fullName: adminUser.fullName,
          fullNameEn: adminUser.fullNameEn ?? undefined,
          role: 'admin',
          permissions: adminPermissions,
          defaultBranchId: mainBranch.id,
          preferredLanguage: adminUser.preferredLanguage,
        },
      };
    });
  }

  /**
   * Get default admin permissions
   */
  private getAdminPermissions(): string[] {
    return [
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'sales:read',
      'sales:create',
      'sales:update',
      'sales:delete',
      'purchases:read',
      'purchases:create',
      'purchases:update',
      'inventory:read',
      'inventory:create',
      'inventory:update',
      'reports:read',
      'settings:read',
      'settings:update',
      'branches:read',
      'branches:create',
      'branches:update',
      'customers:read',
      'customers:create',
      'customers:update',
      'debts:read',
      'debts:create',
      'debts:update',
    ];
  }
}
