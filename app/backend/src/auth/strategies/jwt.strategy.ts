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

    const accessContext = await this.authService.getAccessContextForUser(payload.sub);

    // Return user data that will be attached to request.user
    return {
      id: accessContext.id,
      username: accessContext.username,
      roles: accessContext.roles,
      permissions: accessContext.permissions,
      branchId: accessContext.branchId,
      allowedPages: accessContext.allowedPages,
    };
  }
}
