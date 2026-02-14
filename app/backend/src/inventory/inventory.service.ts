import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { StockLedgerService } from './stock-ledger/stock-ledger.service';
import { StockAccountMapperService } from './stock-ledger/stock-account-mapper.service';
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
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private stockLedgerService: StockLedgerService,
    private stockAccountMapperService: StockAccountMapperService,
  ) {}

  /**
   * Get current stock summary for all items
   */
  async findAll(query: InventoryQueryDto) {
    const { page = 1, pageSize = 20, search, categoryId } = query;
    const skip = (page - 1) * pageSize;

    const where: any = { item: { isActive: true } };

    if (categoryId) {
      where.item = { ...where.item, categoryId };
    }

    if (search) {
      where.OR = [
        { item: { name: { contains: search, mode: 'insensitive' } } },
        { item: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [inventories, totalItems] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          branch: true,
          item: {
            include: {
              category: true,
              inventoryLots: { where: { remainingQuantityGrams: { gt: 0 } } }
            },
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
        branch: true,
        item: {
          include: {
            category: true,
            inventoryLots: { where: { remainingQuantityGrams: { gt: 0 } } }
          },
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
      totalQuantity: lot.totalQuantityGrams,
      remainingQuantity: lot.remainingQuantityGrams,
      unitPurchasePrice: lot.unitPurchasePrice,
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
    const items = await this.prisma.item.findMany({
      where: {
        isActive: true,
        minStockLevelGrams: { not: null },
      },
      include: {
        inventory: { include: { branch: true } },
        category: true
      },
    });

    const lowStockItems = items.filter((item) => {
      const currentQty = item.inventory?.currentQuantityGrams ?? 0;
      const minQty = item.minStockLevelGrams ?? 0;
      return currentQty < minQty;
    });

    return lowStockItems.map((item) => this.toInventoryResponseDto({
      ...item.inventory,
      item: item,
      branchId: item.inventory?.branchId || 0,
      currentQuantityGrams: item.inventory?.currentQuantityGrams || 0,
      reservedQuantityGrams: item.inventory?.reservedQuantityGrams || 0,
      totalValue: item.inventory?.totalValue || 0,
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
      include: {
        item: { include: { category: true } },
        branch: true
      },
      orderBy: { expiryDate: 'asc' },
    });

    return lots.map((lot) => ({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      itemId: lot.itemId,
      itemName: lot.item.name,
      totalQuantity: lot.totalQuantityGrams,
      remainingQuantity: lot.remainingQuantityGrams,
      expiryDate: lot.expiryDate?.toISOString(),
      daysUntilExpiry: lot.expiryDate
        ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }));
  }

  /**
   * Create manual stock adjustment.
   * Updates quantity, totalValue and averageCost for correct accounting.
   * For increase with unitCost, creates an adjustment lot so FIFO stays consistent.
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
    const currentTotalValue = item.inventory?.totalValue ?? 0;
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

    // When increasing from zero, unitCost is required for correct valuation
    if (
      dto.adjustmentType === 'increase' &&
      currentQty === 0 &&
      (dto.unitCost == null || dto.unitCost <= 0)
    ) {
      throw new BadRequestException({
        code: 'UNIT_COST_REQUIRED',
        message: 'Unit cost is required when adding stock to an item with zero quantity',
        messageAr: 'سعر التكلفة مطلوب عند إضافة كمية لصنف رصيده صفر',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    return this.prisma.$transaction(async (tx) => {
      let newTotalValue: number;
      let lotIdForMovement: number | null = dto.lotId ?? null;

      if (dto.adjustmentType === 'decrease') {
        // Proportional deduction: valueOut = (currentValue / currentQty) * quantityOut
        const valueDeduct =
          currentQty > 0
            ? Math.round((currentTotalValue * dto.quantityGrams) / currentQty)
            : 0;
        newTotalValue = Math.max(0, currentTotalValue - valueDeduct);
      } else {
        // Increase
        const costPerKg = dto.unitCost ?? (currentQty > 0 ? Math.round((currentTotalValue * 1000) / currentQty) : 0);
        const addedValue = Math.round((dto.quantityGrams / 1000) * costPerKg);
        newTotalValue = currentTotalValue + addedValue;

        // Create adjustment lot when unitCost provided so FIFO has the new stock
        if (dto.unitCost != null && dto.unitCost > 0) {
          const lotNumber = `LOT-ADJ-${dto.itemId}-${Date.now()}`;
          const lot = await tx.inventoryLot.create({
            data: {
              itemId: dto.itemId,
              lotNumber,
              totalQuantityGrams: dto.quantityGrams,
              remainingQuantityGrams: dto.quantityGrams,
              unitPurchasePrice: dto.unitCost,
              receivedAt: new Date(),
              createdById: userId,
            },
          });
          lotIdForMovement = lot.id;
        }
      }

      const newAverageCost = newQty > 0 ? Math.round((newTotalValue * 1000) / newQty) : 0;

      await tx.inventory.upsert({
        where: { itemId: dto.itemId },
        update: {
          currentQuantityGrams: newQty,
          totalValue: newTotalValue,
          averageCost: newAverageCost,
        },
        create: {
          itemId: dto.itemId,
          currentQuantityGrams: newQty,
          reservedQuantityGrams: 0,
          totalValue: newTotalValue,
          averageCost: newAverageCost,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          itemId: dto.itemId,
          lotId: lotIdForMovement,
          movementType: dto.adjustmentType === 'increase' ? 'adjustment_in' : 'adjustment_out',
          quantityGrams: dto.adjustmentType === 'increase' ? dto.quantityGrams : -dto.quantityGrams,
          unitCost: dto.unitCost ?? undefined,
          referenceType: 'adjustment',
          reason: dto.reason,
          performedById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          username: user?.username ?? 'unknown',
          action: 'adjustment',
          entityType: 'Inventory',
          entityId: dto.itemId,
          changes: JSON.stringify({
            before: currentQty,
            after: newQty,
            valueBefore: currentTotalValue,
            valueAfter: newTotalValue,
            reason: dto.reason,
          }),
        },
      });

      // Blueprint 06: Stock Ledger Entry + GL for adjustment
      const branchId = item.inventory?.branchId ?? null;
      const stockAccountCode = await this.stockAccountMapperService.getStockAccountCode(branchId);
      const now = new Date();
      if (dto.adjustmentType === 'decrease') {
        const valueDeduct = currentQty > 0 ? Math.round((currentTotalValue * dto.quantityGrams) / currentQty) : 0;
        if (valueDeduct > 0) {
          await this.stockLedgerService.createSLE(tx, {
            itemId: dto.itemId,
            branchId,
            voucherType: 'adjustment',
            voucherId: movement.id,
            voucherDetailNo: 'decrease',
            qtyChange: -dto.quantityGrams,
            valuationRate: currentQty > 0 ? Math.round((currentTotalValue * 1000) / currentQty) : 0,
            stockValueDifference: -valueDeduct,
            postingDate: now,
            remarks: dto.reason,
          });
          await this.accountingService.createInventoryAdjustmentJournalEntry(tx, movement.id, branchId, userId, {
            adjustmentType: 'decrease',
            amount: valueDeduct,
            stockAccountCode,
          });
        }
      } else {
        const costPerKg = dto.unitCost ?? (currentQty > 0 ? Math.round((currentTotalValue * 1000) / currentQty) : 0);
        const addedValue = Math.round((dto.quantityGrams / 1000) * costPerKg);
        if (addedValue > 0) {
          await this.stockLedgerService.createSLE(tx, {
            itemId: dto.itemId,
            branchId,
            voucherType: 'adjustment',
            voucherId: movement.id,
            voucherDetailNo: 'increase',
            qtyChange: dto.quantityGrams,
            valuationRate: costPerKg,
            stockValueDifference: addedValue,
            postingDate: now,
            remarks: dto.reason,
          });
          await this.accountingService.createInventoryAdjustmentJournalEntry(tx, movement.id, branchId, userId, {
            adjustmentType: 'increase',
            amount: addedValue,
            stockAccountCode,
          });
        }
      }

      return {
        movementId: movement.id,
        previousQuantityGrams: currentQty,
        newQuantityGrams: newQty,
        previousTotalValue: currentTotalValue,
        newTotalValue,
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
  async deductFromLots(allocations: Array<{ lotId: number; quantityGrams: number }>) {
    for (const alloc of allocations) {
      await this.prisma.inventoryLot.update({
        where: { id: alloc.lotId },
        data: { remainingQuantityGrams: { decrement: alloc.quantityGrams } },
      });
    }
  }

  /**
   * Effective cost (سعر التكلفة المعروض): from actual inventory when we have stock,
   * otherwise fallback to item's expected purchase price. Logic lives in backend only.
   */
  private toInventoryResponseDto(inv: any): InventoryResponseDto {
    const lotCount = inv.item?.inventoryLots?.length ?? 0;
    const currentQty = inv.currentQuantityGrams || 0;
    const fromInventory = currentQty > 0 ? Math.round((inv.totalValue || 0) / (currentQty / 1000)) : 0;
    const avgCost = fromInventory > 0 ? fromInventory : (inv.item?.defaultPurchasePrice ?? 0);

    return {
      itemId: inv.itemId,
      itemCode: inv.item?.code ?? '',
      itemName: inv.item?.name ?? '',
      categoryName: inv.item?.category?.name ?? 'غير مصنف',
      branchId: inv.branchId ?? inv.branch?.id ?? 0,
      branchName: inv.branch?.name ?? 'الفرع الرئيسي',
      totalQuantity: currentQty,
      availableQuantity: currentQty - (inv.reservedQuantityGrams || 0),
      minStockLevel: inv.item?.minStockLevelGrams ?? 0,
      avgCostPrice: avgCost,
      sellingPrice: inv.item?.defaultSalePrice ?? 0,
      unitOfMeasure: 'كجم',
      lotCount,
      lastRestockedAt: inv.lastRestockedAt instanceof Date ? inv.lastRestockedAt.toISOString() : inv.lastRestockedAt,
      lastSoldAt: inv.lastSoldAt instanceof Date ? inv.lastSoldAt.toISOString() : inv.lastSoldAt,
      currentQuantityGrams: currentQty,
      availableQuantityGrams: currentQty - (inv.reservedQuantityGrams || 0),
    };
  }
}
