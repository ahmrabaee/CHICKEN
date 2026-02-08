import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto, BranchResponseDto, BranchListResponseDto } from './dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeInactive = false): Promise<BranchListResponseDto> {
    const branches = await this.prisma.branch.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: [
        { isMainBranch: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return {
      branches: branches.map((branch) => this.toResponseDto(branch, branch._count.users)),
    };
  }

  async findById(id: number): Promise<BranchResponseDto> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
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

    return this.toResponseDto(branch, branch._count.users);
  }

  async create(dto: CreateBranchDto): Promise<BranchResponseDto> {
    // Normalize code to uppercase
    const code = dto.code.toUpperCase();

    const existing = await this.prisma.branch.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Branch code already exists',
        messageAr: 'رمز الفرع موجود بالفعل',
      });
    }

    // Validate scale COM port if hasScale is true
    if (dto.hasScale !== false && !dto.scaleComPort) {
      // hasScale defaults to true, so if not explicitly false and no COM port, that's an error
      if (dto.hasScale === true) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Scale COM port is required when hasScale is true',
          messageAr: 'منفذ الميزان مطلوب عند تفعيل الميزان',
        });
      }
    }

    // New branches cannot be main branch - main branch is set during setup only
    const branch = await this.prisma.branch.create({
      data: {
        code,
        name: dto.name,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        hasScale: dto.hasScale ?? true,
        scaleComPort: dto.scaleComPort,
        isMainBranch: false,
        isActive: true,
      },
    });

    return this.toResponseDto(branch, 0);
  }

  async update(id: number, dto: UpdateBranchDto): Promise<BranchResponseDto> {
    const existing = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }

    // Validate scale COM port if enabling scale
    const willHaveScale = dto.hasScale ?? existing.hasScale;
    const comPort = dto.scaleComPort ?? existing.scaleComPort;
    if (willHaveScale && !comPort) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Scale COM port is required when hasScale is true',
        messageAr: 'منفذ الميزان مطلوب عند تفعيل الميزان',
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
    });

    return this.toResponseDto(branch, existing._count.users);
  }

  async delete(id: number): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });

    if (!branch) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }

    // Cannot deactivate main branch
    if (branch.isMainBranch) {
      throw new ForbiddenException({
        code: 'CANNOT_DELETE_MAIN_BRANCH',
        message: 'Cannot deactivate main branch',
        messageAr: 'لا يمكن إلغاء تفعيل الفرع الرئيسي',
      });
    }

    // Cannot deactivate last active branch
    const activeBranchCount = await this.prisma.branch.count({
      where: { isActive: true },
    });

    if (activeBranchCount <= 1) {
      throw new ForbiddenException({
        code: 'LAST_ACTIVE_BRANCH',
        message: 'Cannot deactivate the last active branch',
        messageAr: 'لا يمكن إلغاء تفعيل آخر فرع نشط',
      });
    }

    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: number): Promise<BranchResponseDto> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
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

    if (branch.isActive) {
      throw new BadRequestException({
        code: 'ALREADY_ACTIVE',
        message: 'Branch is already active',
        messageAr: 'الفرع نشط بالفعل',
      });
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { isActive: true },
    });

    return this.toResponseDto(updated, branch._count.users);
  }

  private toResponseDto(branch: any, userCount: number): BranchResponseDto {
    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      nameEn: branch.nameEn,
      address: branch.address,
      phone: branch.phone,
      hasScale: branch.hasScale,
      scaleComPort: branch.scaleComPort,
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
      userCount,
      createdAt: branch.createdAt.toISOString(),
    };
  }
}
