import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto, BranchResponseDto } from './dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<BranchResponseDto[]> {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { isMainBranch: 'desc' },
    });
    return branches.map(this.toResponseDto);
  }

  async findById(id: number): Promise<BranchResponseDto> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }
    return this.toResponseDto(branch);
  }

  async create(dto: CreateBranchDto): Promise<BranchResponseDto> {
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

    // If setting as main branch, unset others
    if (dto.isMainBranch) {
      await this.prisma.branch.updateMany({
        where: { isMainBranch: true },
        data: { isMainBranch: false },
      });
    }

    const branch = await this.prisma.branch.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        isMainBranch: dto.isMainBranch ?? false,
        isActive: true,
      },
    });
    return this.toResponseDto(branch);
  }

  async update(id: number, dto: UpdateBranchDto): Promise<BranchResponseDto> {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود',
      });
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.branch.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Branch code already exists',
          messageAr: 'رمز الفرع موجود بالفعل',
        });
      }
    }

    if (dto.isMainBranch) {
      await this.prisma.branch.updateMany({
        where: { isMainBranch: true, id: { not: id } },
        data: { isMainBranch: false },
      });
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: dto,
    });
    return this.toResponseDto(branch);
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
      nameEn: branch.nameEn,
      address: branch.address,
      phone: branch.phone,
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
    };
  }
}
