import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto, UpdateItemDto, ItemResponseDto, ItemListQueryDto } from './dto';
import { createPaginatedResult, PaginatedResult } from '../common';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) { }

  async findAll(query: ItemListQueryDto): Promise<PaginatedResult<ItemResponseDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { nameEn: { contains: query.search } },
        { code: { contains: query.search } },
        { barcode: { contains: query.search } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    } else {
      where.isActive = true;
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          category: {
            select: { id: true, code: true, name: true, nameEn: true },
          },
          inventory: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.item.count({ where }),
    ]);

    // Filter low stock if requested
    let filteredItems = items;
    if (query.lowStock) {
      filteredItems = items.filter((item) => {
        if (!item.minStockLevelGrams || !item.inventory) return false;
        return item.inventory.currentQuantityGrams < item.minStockLevelGrams;
      });
    }

    return createPaginatedResult(
      filteredItems.map(this.toResponseDto),
      page,
      pageSize,
      totalItems,
    );
  }

  async findById(id: number): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
        inventory: true,
      },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Item not found',
        messageAr: 'المنتج غير موجود',
      });
    }
    return this.toResponseDto(item);
  }

  async findByCode(code: string): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findUnique({
      where: { code },
      include: {
        category: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
        inventory: true,
      },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Item not found',
        messageAr: 'المنتج غير موجود',
      });
    }
    return this.toResponseDto(item);
  }

  async findByBarcode(barcode: string): Promise<ItemResponseDto> {
    const item = await this.prisma.item.findUnique({
      where: { barcode },
      include: {
        category: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
        inventory: true,
      },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Item not found',
        messageAr: 'المنتج غير موجود',
      });
    }
    return this.toResponseDto(item);
  }

  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let exists = true;

    while (exists) {
      const random = Math.floor(10000 + Math.random() * 90000);
      code = `ITE-${random}`;
      const count = await this.prisma.item.count({ where: { code } });
      if (count === 0) exists = false;
    }

    return code!;
  }

  async create(dto: CreateItemDto, userId?: number): Promise<ItemResponseDto> {
    const code: string = dto.code || (await this.generateUniqueCode());

    // Check code uniqueness only if provided
    if (dto.code) {
      const existingCode = await this.prisma.item.findUnique({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Item code already exists',
          messageAr: 'رمز المنتج موجود بالفعل',
        });
      }
    }

    // Check barcode uniqueness if provided
    if (dto.barcode) {
      const existingBarcode = await this.prisma.item.findUnique({
        where: { barcode: dto.barcode },
      });
      if (existingBarcode) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Barcode already exists',
          messageAr: 'الباركود موجود بالفعل',
        });
      }
    }

    // Validate category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        messageAr: 'الصنف غير موجود',
      });
    }

    const item = await this.prisma.item.create({
      data: {
        code,
        barcode: dto.barcode,
        name: dto.name,
        nameEn: dto.nameEn,
        description: dto.description,
        categoryId: dto.categoryId,
        defaultSalePrice: dto.defaultSalePrice,
        defaultPurchasePrice: dto.defaultPurchasePrice,
        taxRatePct: dto.taxRatePct,
        minStockLevelGrams: dto.minStockLevelGrams,
        maxStockLevelGrams: dto.maxStockLevelGrams,
        shelfLifeDays: dto.shelfLifeDays,
        storageLocation: dto.storageLocation,
        requiresScale: dto.requiresScale ?? true,
        allowNegativeStock: dto.allowNegativeStock ?? false,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
      include: {
        category: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });

    // Create inventory record
    const initialQty = dto.initialQuantityGrams || 0;
    const initialCost = dto.initialCostPrice || 0;

    const inventory = await this.prisma.inventory.create({
      data: {
        itemId: item.id,
        currentQuantityGrams: initialQty,
        reservedQuantityGrams: 0,
        totalValue: Math.round((initialQty / 1000) * initialCost),
        averageCost: initialCost,
      },
    });

    if (initialQty > 0) {
      // Create initial lot
      const lot = await this.prisma.inventoryLot.create({
        data: {
          itemId: item.id,
          lotNumber: `LOT-OP-${item.id}-${Date.now().toString().slice(-6)}`,
          totalQuantityGrams: initialQty,
          remainingQuantityGrams: initialQty,
          unitPurchasePrice: initialCost,
          receivedAt: new Date(),
          createdById: userId,
        },
      });

      // Create stock movement
      await this.prisma.stockMovement.create({
        data: {
          itemId: item.id,
          lotId: lot.id,
          movementType: 'opening',
          quantityGrams: initialQty,
          unitCost: initialCost,
          reason: 'الرصيد الافتتاحي عند التأسيس',
          movementDate: new Date(),
          performedById: userId,
        },
      });
    }

    return this.toResponseDto({ ...item, inventory });
  }

  async update(id: number, dto: UpdateItemDto, userId?: number): Promise<ItemResponseDto> {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Item not found',
        messageAr: 'المنتج غير موجود',
      });
    }

    // Check code uniqueness if changing
    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.item.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Item code already exists',
          messageAr: 'رمز المنتج موجود بالفعل',
        });
      }
    }

    // Check barcode uniqueness if changing
    if (dto.barcode && dto.barcode !== existing.barcode) {
      const duplicate = await this.prisma.item.findUnique({
        where: { barcode: dto.barcode },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_ENTRY',
          message: 'Barcode already exists',
          messageAr: 'الباركود موجود بالفعل',
        });
      }
    }

    // Validate category if changing
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Category not found',
          messageAr: 'الصنف غير موجود',
        });
      }
    }

    const item = await this.prisma.item.update({
      where: { id },
      data: {
        ...dto,
        updatedById: userId,
      },
      include: {
        category: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
        inventory: true,
      },
    });

    return this.toResponseDto(item);
  }

  async delete(id: number): Promise<void> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Item not found',
        messageAr: 'المنتج غير موجود',
      });
    }

    // Soft delete - deactivate
    await this.prisma.item.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private toResponseDto(item: any): ItemResponseDto {
    return {
      id: item.id,
      code: item.code,
      barcode: item.barcode,
      name: item.name,
      nameEn: item.nameEn,
      description: item.description,
      categoryId: item.categoryId,
      defaultSalePrice: item.defaultSalePrice,
      defaultPurchasePrice: item.defaultPurchasePrice,
      effectiveCostPrice:
        item.inventory && item.inventory.currentQuantityGrams > 0
          ? item.inventory.averageCost
          : (item.defaultPurchasePrice ?? 0),
      taxRatePct: item.taxRatePct,
      minStockLevelGrams: item.minStockLevelGrams,
      maxStockLevelGrams: item.maxStockLevelGrams,
      shelfLifeDays: item.shelfLifeDays,
      storageLocation: item.storageLocation,
      requiresScale: item.requiresScale,
      allowNegativeStock: item.allowNegativeStock,
      imageUrl: item.imageUrl,
      isActive: item.isActive,
      category: item.category,
      inventory: item.inventory
        ? {
          currentQuantityGrams: item.inventory.currentQuantityGrams,
          reservedQuantityGrams: item.inventory.reservedQuantityGrams,
          totalValue: item.inventory.totalValue,
          averageCost: item.inventory.averageCost,
        }
        : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
