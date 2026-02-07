import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret-change-me'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Ensure this is an access token, not a refresh token
    if (payload.type === 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Cannot use refresh token for authentication',
        messageAr: 'لا يمكن استخدام رمز التحديث للمصادقة',
      });
    }

    // Get full user data to ensure they still exist and are active
    const user = await this.authService.getUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        messageAr: 'المستخدم غير موجود',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
        messageAr: 'حساب المستخدم غير نشط',
      });
    }

    // Return user data that will be attached to request.user
    return {
      id: payload.sub,
      username: payload.username,
      roles: payload.roles,
      permissions: payload.permissions,
      branchId: payload.branchId,
    };
  }
}
