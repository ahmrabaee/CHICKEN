import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService } from '../inventory/stock-ledger/stock-ledger.service';
import { CreateStockTransferDto } from './dto';

const RAW_CHICKEN_CODE = 'CHK-RAW-01';

@Injectable()
export class StockTransferService {
  constructor(
    private prisma: PrismaService,
    private stockLedgerService: StockLedgerService,
  ) {}

  /**
   * Get available raw chicken lots for transfer (lots with remaining quantity)
   * Uses CHK-RAW-01 or fallback to CHICKEN_RAW category items.
   * Runs backfill for old purchases that have no lots (created before lot-at-create was added).
   */
  async getAvailableSourceLots(branchId?: number | null) {
    let rawItem = await this.prisma.item.findUnique({
      where: { code: RAW_CHICKEN_CODE },
      include: { category: { select: { defaultShelfLifeDays: true } } },
    });
    if (!rawItem) {
      const rawCategory = await this.prisma.category.findUnique({
        where: { code: 'CHICKEN_RAW' },
        include: { purchaseItem: { include: { category: { select: { defaultShelfLifeDays: true } } } } },
      });
      rawItem = rawCategory?.purchaseItem ?? null;
    }
    if (!rawItem) {
      return [];
    }

    const where: any = {
      itemId: rawItem.id,
      remainingQuantityGrams: { gt: 0 },
      stockTransferId: null, // Not created by a transfer (source lots come from purchase)
    };
    if (branchId != null) {
      where.branchId = branchId;
    }

    let lots = await this.prisma.inventoryLot.findMany({
      where,
      include: {
        item: { select: { code: true, name: true, nameEn: true } },
        purchase: { select: { purchaseNumber: true, purchaseDate: true, supplierName: true } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    // Backfill: create lots for purchase lines (raw chicken) that have no lots (old purchases)
    if (lots.length === 0) {
      await this.backfillRawChickenLots(rawItem, branchId);
      lots = await this.prisma.inventoryLot.findMany({
        where,
        include: {
          item: { select: { code: true, name: true, nameEn: true } },
          purchase: { select: { purchaseNumber: true, purchaseDate: true, supplierName: true } },
        },
        orderBy: { receivedAt: 'asc' },
      });
    }

    return lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      itemCode: lot.item.code,
      itemName: lot.item.name,
      remainingQuantityGrams: lot.remainingQuantityGrams,
      remainingKg: (lot.remainingQuantityGrams / 1000).toFixed(2),
      unitPurchasePrice: lot.unitPurchasePrice,
      receivedAt: lot.receivedAt,
      expiryDate: lot.expiryDate,
      purchaseNumber: lot.purchase?.purchaseNumber,
      purchaseDate: lot.purchase?.purchaseDate,
      supplierName: lot.purchase?.supplierName,
    }));
  }

  /**
   * Get products that can be created from raw chicken (exclude raw chicken itself)
   */
  async getTransferrableProducts() {
    const rawItem = await this.prisma.item.findUnique({
      where: { code: RAW_CHICKEN_CODE },
    });

    const where: any = { isActive: true };
    if (rawItem) {
      where.id = { not: rawItem.id };
    }

    return this.prisma.item.findMany({
      where,
      include: { category: { select: { name: true, defaultShelfLifeDays: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [transfers, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        skip,
        take: pageSize,
        include: {
          sourceLot: {
            include: {
              item: { select: { code: true, name: true } },
              purchase: { select: { purchaseNumber: true, supplierName: true } },
            },
          },
          lines: { include: { item: { select: { code: true, name: true } } } },
        },
        orderBy: { transferDate: 'desc' },
      }),
      this.prisma.stockTransfer.count(),
    ]);

    return {
      items: transfers,
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceLot: {
          include: {
            item: true,
            purchase: { include: { supplier: true } },
          },
        },
        lines: { include: { item: true } },
        branch: true,
        createdBy: { select: { fullName: true } },
        completedBy: { select: { fullName: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Stock transfer not found',
        messageAr: 'سند التحويل غير موجود',
      });
    }

    return transfer;
  }

  /**
   * Create and complete a stock transfer
   */
  async create(dto: CreateStockTransferDto, userId: number) {
    const sourceLot = await this.prisma.inventoryLot.findUnique({
      where: { id: dto.sourceLotId },
      include: { item: true },
    });

    if (!sourceLot) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Source lot not found',
        messageAr: 'الدفعة المصدر غير موجودة',
      });
    }

    const rawItem = await this.prisma.item.findUnique({
      where: { code: RAW_CHICKEN_CODE },
    });

    if (!rawItem || sourceLot.itemId !== rawItem.id) {
      throw new BadRequestException({
        code: 'INVALID_SOURCE',
        message: 'Source lot must be raw chicken',
        messageAr: 'الدفعة المصدر يجب أن تكون دجاج خام',
      });
    }

    const totalWeightGrams = dto.lines.reduce((s, l) => s + l.weightGrams, 0);
    if (totalWeightGrams > sourceLot.remainingQuantityGrams) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_QUANTITY',
        message: `Total weight (${totalWeightGrams}g) exceeds available (${sourceLot.remainingQuantityGrams}g)`,
        messageAr: `الوزن الإجمالي (${totalWeightGrams}غ) يتجاوز المتاح (${sourceLot.remainingQuantityGrams}غ)`,
      });
    }

    if (dto.lines.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_LINES',
        message: 'At least one product line is required',
        messageAr: 'يجب إضافة سطر منتج واحد على الأقل',
      });
    }

    const transferNumber = await this.generateTransferNumber();
    const expiryDate = new Date(dto.expiryDate);
    const branchId = dto.branchId ?? sourceLot.branchId;

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          sourceLotId: dto.sourceLotId,
          transferDate: new Date(),
          branchId,
          expiryDate,
          totalWeightGrams,
          totalCostValue: dto.lines.reduce((s, l) => s + Math.round((l.weightGrams / 1000) * l.unitCost), 0),
          status: 'draft',
          notes: dto.notes,
          createdById: userId,
        },
      });

      // Create lines and product lots
      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const lineCostValue = Math.round((line.weightGrams / 1000) * line.unitCost);

        await tx.stockTransferLine.create({
          data: {
            stockTransferId: transfer.id,
            itemId: line.itemId,
            lineNumber: i + 1,
            weightGrams: line.weightGrams,
            unitCost: line.unitCost,
            lineCostValue,
          },
        });

        const lotNumber = await this.generateLotNumber(tx);
        const lot = await tx.inventoryLot.create({
          data: {
            itemId: line.itemId,
            stockTransferId: transfer.id,
            branchId,
            lotNumber,
            totalQuantityGrams: line.weightGrams,
            remainingQuantityGrams: line.weightGrams,
            unitPurchasePrice: line.unitCost,
            receivedAt: new Date(),
            expiryDate,
            createdById: userId,
          },
        });

        // Update target product inventory
        const lotValue = lineCostValue;
        await tx.inventory.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantityGrams: { increment: line.weightGrams },
            totalValue: { increment: lotValue },
            lastRestockedAt: new Date(),
          },
          create: {
            itemId: line.itemId,
            branchId,
            currentQuantityGrams: line.weightGrams,
            reservedQuantityGrams: 0,
            totalValue: lotValue,
            lastRestockedAt: new Date(),
          },
        });

        const inv = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
        if (inv && inv.currentQuantityGrams > 0) {
          await tx.inventory.update({
            where: { itemId: line.itemId },
            data: { averageCost: Math.round((inv.totalValue * 1000) / inv.currentQuantityGrams) },
          });
        }

        // Stock movement (in)
        const targetItem = await tx.item.findUnique({ where: { id: line.itemId } });
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            lotId: lot.id,
            branchId,
            movementType: 'transfer',
            quantityGrams: line.weightGrams,
            unitCost: line.unitCost,
            referenceType: 'stock_transfer',
            referenceId: transfer.id,
            performedById: userId,
          },
        });

        // SLE for product (positive)
        await this.stockLedgerService.createSLE(tx, {
          itemId: line.itemId,
          branchId,
          voucherType: 'transfer',
          voucherId: transfer.id,
          voucherDetailNo: `line-${i + 1}`,
          qtyChange: line.weightGrams,
          valuationRate: line.unitCost,
          stockValueDifference: lotValue,
          postingDate: new Date(),
          remarks: `Stock transfer ${transfer.transferNumber} - ${targetItem?.name}`,
        });
      }

      // Reduce source lot
      const sourceCostPerGram = sourceLot.unitPurchasePrice / 1000;
      const sourceValueReduction = Math.round(totalWeightGrams * sourceCostPerGram);

      await tx.inventoryLot.update({
        where: { id: dto.sourceLotId },
        data: {
          remainingQuantityGrams: { decrement: totalWeightGrams },
        },
      });

      // Update source item inventory
      await tx.inventory.update({
        where: { itemId: sourceLot.itemId },
        data: {
          currentQuantityGrams: { decrement: totalWeightGrams },
          totalValue: { decrement: sourceValueReduction },
        },
      });

      const sourceInv = await tx.inventory.findUnique({ where: { itemId: sourceLot.itemId } });
      if (sourceInv && sourceInv.currentQuantityGrams > 0) {
        await tx.inventory.update({
          where: { itemId: sourceLot.itemId },
          data: { averageCost: Math.round((sourceInv.totalValue * 1000) / sourceInv.currentQuantityGrams) },
        });
      }

      // Stock movement (out) for source
      await tx.stockMovement.create({
        data: {
          itemId: sourceLot.itemId,
          lotId: dto.sourceLotId,
          branchId,
          movementType: 'transfer',
          quantityGrams: -totalWeightGrams,
          unitCost: sourceLot.unitPurchasePrice,
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
          performedById: userId,
        },
      });

      // SLE for source (negative)
      await this.stockLedgerService.createSLE(tx, {
        itemId: sourceLot.itemId,
        branchId,
        voucherType: 'transfer',
        voucherId: transfer.id,
        voucherDetailNo: 'source',
        qtyChange: -totalWeightGrams,
        valuationRate: sourceLot.unitPurchasePrice,
        stockValueDifference: -sourceValueReduction,
        postingDate: new Date(),
        remarks: `Stock transfer ${transfer.transferNumber} - source reduction`,
      });

      // Mark as completed
      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          completedById: userId,
        },
      });

      return this.findById(transfer.id);
    });
  }

  private async generateTransferNumber(): Promise<string> {
    const count = await this.prisma.stockTransfer.count();
    return `ST-${(count + 1).toString().padStart(6, '0')}`;
  }

  private async generateLotNumber(tx: any): Promise<string> {
    const prisma = tx ?? this.prisma;
    const count = await prisma.inventoryLot.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LOT-${date}-${(count + 1).toString().padStart(3, '0')}`;
  }

  /**
   * Backfill InventoryLot for purchase lines (raw chicken) that have no lots.
   * Fixes purchases created before we added lot-at-create logic.
   */
  private async backfillRawChickenLots(
    rawItem: { id: number; shelfLifeDays?: number | null; category?: { defaultShelfLifeDays?: number | null } | null },
    branchId?: number | null,
  ): Promise<void> {
    const existingLotLineIds = (
      await this.prisma.inventoryLot.findMany({
        where: { itemId: rawItem.id, purchaseLineId: { not: null } },
        select: { purchaseLineId: true },
      })
    )
      .map((l) => l.purchaseLineId!)
      .filter((id): id is number => id != null);

    // Include all raw chicken purchase lines without lots (covers old purchases without receivedAt)
    const whereLine: { itemId: number; id?: { notIn: number[] } } = {
      itemId: rawItem.id,
    };
    if (existingLotLineIds.length > 0) {
      whereLine.id = { notIn: existingLotLineIds };
    }

    const linesWithoutLots = await this.prisma.purchaseLine.findMany({
      where: whereLine,
      include: { purchase: true },
    });

    if (linesWithoutLots.length === 0) return;

    const shelfDays = rawItem.shelfLifeDays ?? rawItem.category?.defaultShelfLifeDays ?? 5;

    await this.prisma.$transaction(async (tx) => {
      for (const line of linesWithoutLots) {
        const lineTotal = Math.round((line.weightGrams / 1000) * line.pricePerKg);
        const lotBranchId = branchId ?? line.purchase.branchId ?? null;

        const lotNumber = await this.generateLotNumber(tx);
        await tx.inventoryLot.create({
          data: {
            itemId: line.itemId,
            purchaseId: line.purchaseId,
            purchaseLineId: line.id,
            branchId: lotBranchId,
            lotNumber,
            totalQuantityGrams: line.weightGrams,
            remainingQuantityGrams: line.weightGrams,
            unitPurchasePrice: line.pricePerKg,
            receivedAt: line.purchase.receivedAt ?? line.purchase.purchaseDate ?? new Date(),
            expiryDate: new Date(
              (line.purchase.receivedAt ?? line.purchase.purchaseDate ?? new Date()).getTime() +
                shelfDays * 24 * 60 * 60 * 1000,
            ),
          },
        });

        await tx.inventory.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantityGrams: { increment: line.weightGrams },
            totalValue: { increment: lineTotal },
            lastRestockedAt: new Date(),
          },
          create: {
            itemId: line.itemId,
            branchId: lotBranchId,
            currentQuantityGrams: line.weightGrams,
            reservedQuantityGrams: 0,
            totalValue: lineTotal,
            lastRestockedAt: new Date(),
          },
        });

        const inv = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
        if (inv && inv.currentQuantityGrams > 0) {
          await tx.inventory.update({
            where: { itemId: line.itemId },
            data: { averageCost: Math.round((inv.totalValue * 1000) / inv.currentQuantityGrams) },
          });
        }

        const lot = await tx.inventoryLot.findFirst({
          where: { purchaseLineId: line.id },
        });
        if (lot) {
          await tx.stockMovement.create({
            data: {
              itemId: line.itemId,
              lotId: lot.id,
              branchId: lotBranchId,
              movementType: 'purchase',
              quantityGrams: line.weightGrams,
              unitCost: line.pricePerKg,
              referenceType: 'purchase',
              referenceId: line.purchaseId,
            },
          });

          await this.stockLedgerService.createSLE(tx, {
            itemId: line.itemId,
            branchId: lotBranchId,
            voucherType: 'purchase',
            voucherId: line.purchaseId,
            voucherDetailNo: `lot-${lotNumber}`,
            qtyChange: line.weightGrams,
            valuationRate: line.pricePerKg,
            stockValueDifference: lineTotal,
            postingDate: line.purchase.receivedAt ?? line.purchase.purchaseDate ?? new Date(),
            remarks: `Backfill: Purchase ${line.purchase.purchaseNumber}`,
          });
        }
      }
    });
  }
}
