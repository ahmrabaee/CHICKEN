import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeInactive = false): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return categories.map(this.toResponseDto);
  }

  async findById(id: number): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        messageAr: 'الصنف غير موجود',
      });
    }
    return this.toResponseDto(category);
  }

  async findByCode(code: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({ where: { code } });
    if (!category) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        messageAr: 'الصنف غير موجود',
      });
    }
    return this.toResponseDto(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Category code already exists',
        messageAr: 'رمز الصنف موجود بالفعل',
      });
    }

    const category = await this.prisma.category.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        displayOrder: dto.displayOrder ?? 0,
        icon: dto.icon,
        defaultShelfLifeDays: dto.defaultShelfLifeDays,
        storageType: dto.storageType,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toResponseDto(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        messageAr: 'الصنف غير موجود',
      });
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.category.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Category code already exists',
          messageAr: 'رمز الصنف موجود بالفعل',
        });
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    return this.toResponseDto(category);
  }

  async delete(id: number): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        messageAr: 'الصنف غير موجود',
      });
    }

    // Check if category has items
    const itemCount = await this.prisma.item.count({
      where: { categoryId: id },
    });
    if (itemCount > 0) {
      // Soft delete - deactivate instead
      await this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no items
      await this.prisma.category.delete({ where: { id } });
    }
  }

  private toResponseDto(category: any): CategoryResponseDto {
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      nameEn: category.nameEn,
      displayOrder: category.displayOrder,
      icon: category.icon,
      defaultShelfLifeDays: category.defaultShelfLifeDays,
      storageType: category.storageType,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
