import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findPurchaseable(): Promise<CategoryResponseDto[]> {
    await this.ensureCategoriesHavePurchaseItem();
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, purchaseItemId: { not: null } },
      include: { purchaseItem: true },
      orderBy: { displayOrder: 'asc' },
    });
    return categories.map((c) => this.toResponseDto(c));
  }

  /**
   * Ensures all active categories have a linked purchase item (for purchase dropdown).
   * Creates items for categories that were added before we had auto-linking.
   */
  private async ensureCategoriesHavePurchaseItem(): Promise<void> {
    const categoriesWithoutItem = await this.prisma.category.findMany({
      where: { isActive: true, purchaseItemId: null },
    });
    for (const cat of categoriesWithoutItem) {
      await this.prisma.$transaction(async (tx) => {
        const itemCode = await this.generateUniqueItemCode(tx, cat.code);
        const purchaseItem = await tx.item.create({
          data: {
            code: itemCode,
            name: cat.name,
            nameEn: cat.nameEn,
            categoryId: cat.id,
            defaultSalePrice: 0,
            defaultPurchasePrice: 0,
            requiresScale: true,
            allowNegativeStock: false,
          },
        });
        await tx.category.update({
          where: { id: cat.id },
          data: { purchaseItemId: purchaseItem.id },
        });
      });
    }
  }

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
    const code = dto.code?.trim() || (await this.generateCategoryCode());
    const existing = await this.prisma.category.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Category code already exists',
        messageAr: 'رمز الصنف موجود بالفعل',
      });
    }

    const maxOrder = await this.prisma.category.aggregate({
      _max: { displayOrder: true },
    });
    const displayOrder = dto.displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          code,
          name: dto.name.trim(),
          nameEn: dto.nameEn?.trim() || null,
          displayOrder,
          icon: dto.icon,
          defaultShelfLifeDays: dto.defaultShelfLifeDays,
          storageType: dto.storageType,
          isActive: dto.isActive ?? true,
        },
      });

      const itemCode = await this.generateUniqueItemCode(tx, code);
      const purchaseItem = await tx.item.create({
        data: {
          code: itemCode,
          name: dto.name.trim(),
          nameEn: dto.nameEn?.trim() || null,
          categoryId: category.id,
          defaultSalePrice: 0,
          defaultPurchasePrice: 0,
          requiresScale: true,
          allowNegativeStock: false,
        },
      });

      await tx.category.update({
        where: { id: category.id },
        data: { purchaseItemId: purchaseItem.id },
      });

      const updated = await tx.category.findUnique({
        where: { id: category.id },
        include: { purchaseItem: true },
      });
      return this.toResponseDto(updated);
    });
  }

  private async generateUniqueItemCode(tx: any, baseCode: string): Promise<string> {
    const sanitized = baseCode.replace(/[^A-Za-z0-9]/g, '_').toUpperCase().slice(0, 20);
    let candidate = `ITEM_${sanitized}`;
    let n = 1;
    while (await (tx ?? this.prisma).item.findUnique({ where: { code: candidate } })) {
      candidate = `ITEM_${sanitized}_${n}`;
      n++;
    }
    return candidate;
  }

  private async generateCategoryCode(): Promise<string> {
    const count = await this.prisma.category.count();
    return `CAT_${(count + 1).toString().padStart(4, '0')}`;
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
    const dto: CategoryResponseDto = {
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
    if (category.purchaseItemId != null) dto.purchaseItemId = category.purchaseItemId;
    if (category.purchaseItem) {
      dto.purchaseItem = {
        id: category.purchaseItem.id,
        code: category.purchaseItem.code,
        name: category.purchaseItem.name,
        defaultPurchasePrice: category.purchaseItem.defaultPurchasePrice,
        defaultSalePrice: category.purchaseItem.defaultSalePrice,
      };
    }
    return dto;
  }
}
