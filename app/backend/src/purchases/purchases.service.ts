import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  async findAll(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [purchases, totalItems] = await Promise.all([
      this.prisma.purchase.findMany({
        skip,
        take: pageSize,
        include: { supplier: true, purchaseLines: { include: { item: true } } },
        orderBy: { purchaseDate: 'desc' },
      }),
      this.prisma.purchase.count(),
    ]);

    return createPaginatedResult(purchases, page, pageSize, totalItems);
  }

  async findById(id: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseLines: { include: { item: true } },
        inventoryLots: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        messageAr: 'أمر الشراء غير موجود',
      });
    }

    // Get payments separately
    const payments = await this.prisma.payment.findMany({
      where: { referenceType: 'purchase', referenceId: id },
    });

    return { ...purchase, payments };
  }

  async create(dto: any, userId: number) {
    const purchaseNumber = await this.generatePurchaseNumber();
    
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Supplier not found',
        messageAr: 'المورد غير موجود',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;

      for (const line of dto.lines) {
        const lineAmount = Math.round((line.weightGrams / 1000) * line.pricePerKg);
        totalAmount += lineAmount;
      }

      const taxAmount = dto.taxAmount ?? 0;
      totalAmount += taxAmount;

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: dto.supplierId,
          supplierName: supplier.name,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          taxAmount,
          totalAmount,
          paymentStatus: 'unpaid',
          notes: dto.notes,
          createdById: userId,
        },
      });

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        
        if (!item) continue;

        const lineTotal = Math.round((line.weightGrams / 1000) * line.pricePerKg);

        await tx.purchaseLine.create({
          data: {
            purchaseId: purchase.id,
            lineNumber: i + 1,
            itemId: line.itemId,
            itemName: item.name,
            itemCode: item.code,
            weightGrams: line.weightGrams,
            pricePerKg: line.pricePerKg,
            lineTotalAmount: lineTotal,
            isLiveBird: line.isLiveBird ?? false,
          },
        });
      }

      return this.findById(purchase.id);
    });
  }

  async receive(id: number, dto: any, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { purchaseLines: true },
    });

    if (!purchase) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        messageAr: 'أمر الشراء غير موجود',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const lineDto of dto.lines) {
        const line = purchase.purchaseLines.find((l) => l.id === lineDto.purchaseLineId);
        if (!line) continue;

        const lotNumber = lineDto.lotNumber ?? await this.generateLotNumber(tx);
        const item = await tx.item.findUnique({ where: { id: line.itemId } });

        // Create inventory lot
        const lot = await tx.inventoryLot.create({
          data: {
            itemId: line.itemId,
            purchaseId: id,
            purchaseLineId: line.id,
            lotNumber,
            totalQuantityGrams: lineDto.receivedWeightGrams,
            remainingQuantityGrams: lineDto.receivedWeightGrams,
            unitPurchasePrice: line.pricePerKg,
            receivedAt: new Date(),
            expiryDate: item?.shelfLifeDays
              ? new Date(Date.now() + item.shelfLifeDays * 24 * 60 * 60 * 1000)
              : null,
            createdById: userId,
          },
        });

        // Update inventory
        const lotValue = Math.round((lineDto.receivedWeightGrams / 1000) * line.pricePerKg);
        await tx.inventory.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantityGrams: { increment: lineDto.receivedWeightGrams },
            totalValue: { increment: lotValue },
            lastRestockedAt: new Date(),
          },
          create: {
            itemId: line.itemId,
            currentQuantityGrams: lineDto.receivedWeightGrams,
            reservedQuantityGrams: 0,
            totalValue: lotValue,
            lastRestockedAt: new Date(),
          },
        });
        // Keep averageCost in sync (minor units per kg)
        const inv = await tx.inventory.findUnique({ where: { itemId: line.itemId } });
        if (inv && inv.currentQuantityGrams > 0) {
          await tx.inventory.update({
            where: { itemId: line.itemId },
            data: { averageCost: Math.round((inv.totalValue * 1000) / inv.currentQuantityGrams) },
          });
        }

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            lotId: lot.id,
            movementType: 'purchase',
            quantityGrams: lineDto.receivedWeightGrams,
            unitCost: line.pricePerKg,
            referenceType: 'purchase',
            referenceId: id,
            performedById: userId,
          },
        });
      }

      await tx.purchase.update({
        where: { id },
        data: { receivedAt: new Date(), receivedById: userId },
      });

      // Create journal entry for inventory receipt
      // Calculate total received value
      let totalReceivedValue = 0;
      for (const lineDto of dto.lines) {
        const line = purchase.purchaseLines.find((l: any) => l.id === lineDto.purchaseLineId);
        if (line) {
          totalReceivedValue += Math.round((lineDto.receivedWeightGrams / 1000) * line.pricePerKg);
        }
      }

      await this.accountingService.createPurchaseJournalEntry(
        tx,
        purchase.id,
        purchase.purchaseNumber,
        purchase.branchId ?? null,
        userId,
        {
          totalAmount: totalReceivedValue,
          amountPaid: 0, // Payment is recorded separately
        },
      );

      return this.findById(id);
    });
  }

  private async generatePurchaseNumber(): Promise<string> {
    const count = await this.prisma.purchase.count();
    return `PUR-${(count + 1).toString().padStart(6, '0')}`;
  }

  private async generateLotNumber(tx: any): Promise<string> {
    const count = await tx.inventoryLot.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LOT-${date}-${(count + 1).toString().padStart(3, '0')}`;
  }
}
