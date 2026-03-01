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
        stockAccount: { select: { id: true, code: true, name: true } },
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
        stockAccount: { select: { id: true, code: true, name: true } },
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

    // New branches cannot be main branch - main branch is set during setup only
    const branch = await this.prisma.branch.create({
      data: {
        code,
        name: dto.name,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        hasScale: false,
        stockAccountId: dto.stockAccountId,
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

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        stockAccountId: dto.stockAccountId,
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
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
      stockAccountId: branch.stockAccountId,
      stockAccount: branch.stockAccount ? { id: branch.stockAccount.id, code: branch.stockAccount.code, name: branch.stockAccount.name } : undefined,
      userCount,
      createdAt: branch.createdAt.toISOString(),
    };
  }
}
