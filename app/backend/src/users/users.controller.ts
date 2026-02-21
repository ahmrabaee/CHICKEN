import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserListQueryDto,
} from './dto';
import {
  CurrentUser,
  CurrentUserData,
  Roles,
  RolesGuard,
} from '../common';
import { AdminResetPasswordDto, MessageResponse } from '../auth/dto';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'List all users (paginated)',
    description: 'Get a paginated list of all users. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
  })
  async findAll(@Query() query: UserListQueryDto) {
    return this.usersService.findAll(query, query);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserResponseDto,
  })
  async getMe(@CurrentUser() user: CurrentUserData): Promise<UserResponseDto> {
    return this.usersService.findById(user.id);
  }

  @Get('roles')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Get list of available roles for user assignment',
  })
  async getRoles() {
    return this.usersService.getRoles();
  }

  @Get('active-sessions')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Get all active user sessions',
    description: 'Returns a list of users currently logged in (PRD requirement)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active sessions',
  })
  async getActiveSessions() {
    return this.usersService.getActiveSessions();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Get detailed information about a specific user. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Create new user',
    description: 'Create a new user account. Admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Username or email already exists',
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Put('me')
  @ApiOperation({
    summary: 'Update own profile',
    description: 'Update the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  async updateMe(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Users can only update limited fields on their own profile
    return this.usersService.updateProfile(user.id, {
      fullName: dto.fullName,
      fullNameEn: dto.fullNameEn,
      email: dto.email,
      phone: dto.phone,
      preferredLanguage: dto.preferredLanguage,
    });
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update an existing user. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Deactivate (soft delete) a user account. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 204,
    description: 'User deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot deactivate own account or last admin',
  })
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    await this.usersService.delete(id, user.id);
  }

  // ============================================
  // Admin Password Reset & Session Management
  // ============================================

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset user password (admin only)',
    description:
      'Admin can reset any user password. This will invalidate all active sessions for that user.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: MessageResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminResetPasswordDto,
  ): Promise<MessageResponse> {
    await this.usersService.resetPassword(id, dto.newPassword);
    return {
      message: 'Password reset successfully',
      messageAr: 'تم إعادة تعيين كلمة المرور بنجاح',
    };
  }

}
