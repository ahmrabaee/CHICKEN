import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserListQueryDto } from './dto';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all users with optional filters
   */
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
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map(this.toResponseDto);
    return createPaginatedResult(items, page, pageSize, totalItems);
  }

  /**
   * Get user by ID
   */
  async findById(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
        messageAr: 'المستخدم غير موجود',
      });
    }

    return this.toResponseDto(user);
  }

  /**
   * Get user by username
   */
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Create a new user
   */
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    // Check for duplicate username
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Username already exists',
        messageAr: 'اسم المستخدم موجود بالفعل',
      });
    }

    // Check for duplicate email
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingEmail) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Email already exists',
          messageAr: 'البريد الإلكتروني موجود بالفعل',
        });
      }
    }

    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Role not found',
        messageAr: 'الدور غير موجود',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user with role
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        fullNameEn: dto.fullNameEn,
        email: dto.email,
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage || 'ar',
        defaultBranchId: dto.defaultBranchId,
        isActive: true,
        userRoles: {
          create: {
            roleId: dto.roleId,
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

    return this.toResponseDto(user);
  }

  /**
   * Update user
   */
  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
        messageAr: 'المستخدم غير موجود',
      });
    }

    // Check for duplicate username
    if (dto.username && dto.username !== existing.username) {
      const duplicate = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Username already exists',
          messageAr: 'اسم المستخدم موجود بالفعل',
        });
      }
    }

    // Check for duplicate email
    if (dto.email && dto.email !== existing.email) {
      const duplicate = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Email already exists',
          messageAr: 'البريد الإلكتروني موجود بالفعل',
        });
      }
    }

    // Build update data
    const updateData: any = {
      fullName: dto.fullName,
      fullNameEn: dto.fullNameEn,
      email: dto.email,
      phone: dto.phone,
      preferredLanguage: dto.preferredLanguage,
      defaultBranchId: dto.defaultBranchId,
    };

    if (dto.username) {
      updateData.username = dto.username;
    }

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    // Update role if provided
    if (dto.roleId) {
      // Delete existing roles and add new one
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      await this.prisma.userRole.create({
        data: {
          userId: id,
          roleId: dto.roleId,
        },
      });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return this.toResponseDto(user);
  }

  /**
   * Deactivate user (soft delete)
   */
  async delete(id: number, currentUserId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
        messageAr: 'المستخدم غير موجود',
      });
    }

    // Cannot delete yourself
    if (id === currentUserId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot deactivate your own account',
        messageAr: 'لا يمكنك إلغاء تفعيل حسابك الخاص',
      });
    }

    // Check if this is the last admin
    const isAdmin = user.userRoles.some((ur) => ur.role.name === 'admin');
    if (isAdmin) {
      const adminCount = await this.prisma.userRole.count({
        where: {
          role: { name: 'admin' },
          user: { isActive: true },
        },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Cannot deactivate the last admin user',
          messageAr: 'لا يمكن إلغاء تفعيل آخر مسؤول',
        });
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        refreshToken: null,
      },
    });
  }

  /**
   * Update user's own profile
   */
  async updateProfile(
    id: number,
    dto: Partial<Pick<UpdateUserDto, 'fullName' | 'fullNameEn' | 'email' | 'phone' | 'preferredLanguage'>>,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        fullNameEn: dto.fullNameEn,
        email: dto.email,
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return this.toResponseDto(user);
  }

  /**
   * Get all roles
   */
  async getRoles() {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        nameAr: true,
        description: true,
      },
    });
  }

  // Helper to convert user entity to response DTO
  private toResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      fullNameEn: user.fullNameEn,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      defaultBranchId: user.defaultBranchId,
      isActive: user.isActive,
      roles: user.userRoles.map((ur: any) => ur.role.name),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
    };
  }
}
