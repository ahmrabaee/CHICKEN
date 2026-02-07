import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  ChangePasswordDto,
  RefreshTokenDto,
  LoginResponse,
  RefreshResponse,
  MessageResponse,
} from './dto';
import { Public, CurrentUser, CurrentUserData } from '../common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user and issue tokens',
    description: 'Login with username and password to receive JWT access and refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Use refresh token to obtain a new access token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() refreshDto: RefreshTokenDto): Promise<RefreshResponse> {
    return this.authService.refreshToken(refreshDto.refreshToken!);
  }

  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout and invalidate session',
    description: 'Invalidate the current refresh token, ending the session',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: MessageResponse,
  })
  async logout(@CurrentUser() user: CurrentUserData): Promise<MessageResponse> {
    await this.authService.logout(user.id);
    return {
      message: 'Logged out successfully',
      messageAr: 'تم تسجيل الخروج بنجاح',
    };
  }

  @Post('change-password')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change current user password',
    description: 'Change the password for the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Current password is incorrect',
  })
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    await this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return {
      message: 'Password changed successfully',
      messageAr: 'تم تغيير كلمة المرور بنجاح',
    };
  }
}
