import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryResponseDto,
  InventoryLotResponseDto,
  StockMovementResponseDto,
  CreateAdjustmentDto,
  InventoryQueryDto,
} from './dto';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get current stock summary for all items
   */
  async findAll(query: InventoryQueryDto, pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: any = { item: { isActive: true } };
    
    if (query.categoryId) {
      where.item = { ...where.item, categoryId: query.categoryId };
    }

    const [inventories, totalItems] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          item: {
            include: { inventoryLots: { where: { remainingQuantityGrams: { gt: 0 } } } },
          },
        },
        orderBy: { item: { name: 'asc' } },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    const items = inventories.map((inv) => this.toInventoryResponseDto(inv));
    return createPaginatedResult(items, page, pageSize, totalItems);
  }

  /**
   * Get stock for specific item
   */
  async findByItemId(itemId: number): Promise<InventoryResponseDto> {
    const inventory = await this.prisma.inventory.findFirst({
      where: { itemId },
      include: {
        item: {
          include: { inventoryLots: { where: { remainingQuantityGrams: { gt: 0 } } } },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory not found for this item',
        messageAr: 'لم يتم العثور على مخزون لهذا المنتج',
      });
    }

    return this.toInventoryResponseDto(inventory);
  }

  /**
   * Get FIFO lots for an item
   */
  async getLots(itemId: number): Promise<InventoryLotResponseDto[]> {
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        itemId,
        remainingQuantityGrams: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
      include: { purchase: { select: { purchaseNumber: true } } },
    });

    return lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      totalQuantityGrams: lot.totalQuantityGrams,
      remainingQuantityGrams: lot.remainingQuantityGrams,
      unitPurchasePricePerKg: lot.unitPurchasePrice,
      receivedAt: lot.receivedAt.toISOString(),
      expiryDate: lot.expiryDate?.toISOString(),
      purchaseNumber: lot.purchase?.purchaseNumber,
    }));
  }

  /**
   * Get stock movements for an item
   */
  async getMovements(itemId: number, pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [movements, totalItems] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { itemId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where: { itemId } }),
    ]);

    const items: StockMovementResponseDto[] = movements.map((m) => ({
      id: m.id,
      itemId: m.itemId,
      movementType: m.movementType,
      quantityGrams: m.quantityGrams,
      costPerKgMinor: m.unitCost ?? 0,
      referenceType: m.referenceType ?? '',
      referenceId: m.referenceId ?? 0,
      notes: m.reason ?? undefined,
      createdAt: m.createdAt.toISOString(),
    }));

    return createPaginatedResult(items, page, pageSize, totalItems);
  }

  /**
   * Get items below minimum stock level
   */
  async getLowStock() {
    // Get all items with inventory and filter in code
    const items = await this.prisma.item.findMany({
      where: {
        isActive: true,
        minStockLevelGrams: { not: null },
      },
      include: { inventory: true, category: true },
    });

    // Filter items where current quantity is below minimum
    const lowStockItems = items.filter((item) => {
      const currentQty = item.inventory?.currentQuantityGrams ?? 0;
      const minQty = item.minStockLevelGrams ?? 0;
      return currentQty < minQty;
    });

    return lowStockItems.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      categoryName: item.category?.name ?? 'Unknown',
      currentQuantityGrams: item.inventory?.currentQuantityGrams ?? 0,
      minStockLevelGrams: item.minStockLevelGrams ?? 0,
      shortageGrams: Math.max(0, (item.minStockLevelGrams ?? 0) - (item.inventory?.currentQuantityGrams ?? 0)),
    }));
  }

  /**
   * Get items expiring soon
   */
  async getExpiring(daysAhead: number = 3) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        remainingQuantityGrams: { gt: 0 },
        expiryDate: { lte: expiryDate },
      },
      include: { item: true },
      orderBy: { expiryDate: 'asc' },
    });

    return lots.map((lot) => ({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      itemId: lot.itemId,
      itemName: lot.item.name,
      remainingQuantityGrams: lot.remainingQuantityGrams,
      expiryDate: lot.expiryDate?.toISOString(),
      daysUntilExpiry: lot.expiryDate
        ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }));
  }

  /**
   * Create manual stock adjustment
   */
  async createAdjustment(dto: CreateAdjustmentDto, userId: number) {
    const item = await this.prisma.item.findUnique({
      where: { id: dto.itemId },
      include: { inventory: true },
    });

    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Item not found',
        messageAr: 'المنتج غير موجود',
      });
    }

    const currentQty = item.inventory?.currentQuantityGrams ?? 0;
    const newQty =
      dto.adjustmentType === 'increase'
        ? currentQty + dto.quantityGrams
        : currentQty - dto.quantityGrams;

    if (newQty < 0 && !item.allowNegativeStock) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient stock for this adjustment',
        messageAr: 'المخزون غير كاف لهذا التعديل',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Create adjustment in transaction
    return this.prisma.$transaction(async (tx) => {
      // Update inventory
      await tx.inventory.upsert({
        where: { itemId: dto.itemId },
        update: {
          currentQuantityGrams: newQty,
        },
        create: {
          itemId: dto.itemId,
          currentQuantityGrams: newQty,
          reservedQuantityGrams: 0,
          totalValue: 0,
        },
      });

      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          itemId: dto.itemId,
          lotId: dto.lotId,
          movementType: dto.adjustmentType === 'increase' ? 'adjustment_in' : 'adjustment_out',
          quantityGrams: dto.adjustmentType === 'increase' ? dto.quantityGrams : -dto.quantityGrams,
          unitCost: dto.unitCost,
          referenceType: 'adjustment',
          reason: dto.reason,
          performedById: userId,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          username: user?.username ?? 'unknown',
          action: 'adjustment',
          entityType: 'Inventory',
          entityId: dto.itemId,
          changes: JSON.stringify({ before: currentQty, after: newQty, reason: dto.reason }),
        },
      });

      return {
        movementId: movement.id,
        previousQuantityGrams: currentQty,
        newQuantityGrams: newQty,
        adjustmentGrams: dto.quantityGrams,
        type: dto.adjustmentType,
      };
    });
  }

  /**
   * FIFO: Get available lots ordered by received date
   */
  async getAvailableLots(itemId: number) {
    return this.prisma.inventoryLot.findMany({
      where: {
        itemId,
        remainingQuantityGrams: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
    });
  }

  /**
   * FIFO: Allocate stock from oldest lots first
   * Returns array of allocations
   */
  async allocateFIFO(itemId: number, requiredGrams: number) {
    const lots = await this.getAvailableLots(itemId);
    const allocations: Array<{
      lotId: number;
      lotNumber: string;
      quantityGrams: number;
      costPerKg: number;
      totalCost: number;
    }> = [];

    let remaining = requiredGrams;

    for (const lot of lots) {
      if (remaining <= 0) break;

      const allocateQty = Math.min(lot.remainingQuantityGrams, remaining);
      const costPerKg = lot.unitPurchasePrice;
      const totalCost = Math.round((allocateQty / 1000) * costPerKg);

      allocations.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantityGrams: allocateQty,
        costPerKg,
        totalCost,
      });

      remaining -= allocateQty;
    }

    if (remaining > 0) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Insufficient stock. Short by ${remaining}g`,
        messageAr: `المخزون غير كاف. ينقص ${remaining} جرام`,
      });
    }

    return allocations;
  }

  /**
   * FIFO: Deduct from lots after sale confirmation
   */
  async deductFromLots(
    allocations: Array<{ lotId: number; quantityGrams: number }>,
  ) {
    for (const alloc of allocations) {
      await this.prisma.inventoryLot.update({
        where: { id: alloc.lotId },
        data: {
          remainingQuantityGrams: { decrement: alloc.quantityGrams },
        },
      });
    }
  }

  private toInventoryResponseDto(inv: any): InventoryResponseDto {
    const lotCount = inv.item?.inventoryLots?.length ?? 0;
    const currentQty = inv.currentQuantityGrams;
    const avgCost = currentQty > 0 ? Math.round(inv.totalValue / (currentQty / 1000)) : 0;

    return {
      itemId: inv.itemId,
      itemCode: inv.item?.code ?? '',
      itemName: inv.item?.name ?? '',
      currentQuantityGrams: currentQty,
      reservedQuantityGrams: inv.reservedQuantityGrams,
      availableQuantityGrams: currentQty - inv.reservedQuantityGrams,
      totalValue: inv.totalValue,
      averageCostPerKg: avgCost,
      minStockLevelGrams: inv.item?.minStockLevelGrams ?? 0,
      lastRestockedAt: inv.lastRestockedAt?.toISOString(),
      lastSoldAt: inv.lastSoldAt?.toISOString(),
      lotCount,
    };
  }
}
