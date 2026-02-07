import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginResponse, RefreshResponse, AuthUserResponse } from './dto';

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

    // Store refresh token hash in database
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
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

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

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
          code: 'INVALID_TOKEN',
          message: 'Invalid refresh token',
          messageAr: 'رمز التحديث غير صالح',
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
    } catch {
      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh token expired or invalid',
        messageAr: 'انتهت صلاحية رمز التحديث',
      });
    }
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        refreshToken: null, // Invalidate all sessions
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
}
