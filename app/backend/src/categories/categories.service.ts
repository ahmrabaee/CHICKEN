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
        messageAr: 'الفئة غير موجودة',
      });
    }

    // Collect ALL items linked to this category
    const allItems = await this.prisma.item.findMany({
      where: { categoryId: id },
      select: { id: true },
    });

    if (allItems.length > 0) {
      const allIds = allItems.map((i) => i.id);

      // Block only if any item has real transaction history (onDelete: Restrict tables)
      const [saleLinesCount, purchaseLinesCount, stockMovementsCount, wastageCount, transferLinesCount, ledgerCount] =
        await Promise.all([
          this.prisma.saleLine.count({ where: { itemId: { in: allIds } } }),
          this.prisma.purchaseLine.count({ where: { itemId: { in: allIds } } }),
          this.prisma.stockMovement.count({ where: { itemId: { in: allIds } } }),
          this.prisma.wastageRecord.count({ where: { itemId: { in: allIds } } }),
          this.prisma.stockTransferLine.count({ where: { itemId: { in: allIds } } }),
          this.prisma.stockLedgerEntry.count({ where: { itemId: { in: allIds } } }),
        ]);

      const totalDeps =
        saleLinesCount + purchaseLinesCount + stockMovementsCount + wastageCount + transferLinesCount + ledgerCount;

      if (totalDeps > 0) {
        throw new ConflictException({
          code: 'CATEGORY_HAS_HISTORY',
          message: `Cannot delete category: its items have transaction history (${totalDeps} record(s))`,
          messageAr: `لا يمكن حذف الفئة لأن أصنافها تحتوي على سجلات معاملات (${totalDeps} سجل). لا يمكن حذف بيانات لها تاريخ محاسبي.`,
        });
      }

      // No transaction history — cascade delete items then category in one transaction
      await this.prisma.$transaction(async (tx) => {
        // Nullify any category.purchaseItemId pointing at these items
        await tx.category.updateMany({
          where: { purchaseItemId: { in: allIds } },
          data: { purchaseItemId: null },
        });
        // Hard-delete items (Inventory + InventoryLots cascade via onDelete: Cascade)
        await tx.item.deleteMany({ where: { id: { in: allIds } } });
        // Delete the category itself
        await tx.category.delete({ where: { id } });
      });
      return;
    }

    // No items at all — direct delete
    await this.prisma.category.delete({ where: { id } });
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
