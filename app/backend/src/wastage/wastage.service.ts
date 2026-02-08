import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class WastageService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  async findAll(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [records, totalItems] = await Promise.all([
      this.prisma.wastageRecord.findMany({
        skip,
        take: pageSize,
        include: { item: true, lot: true, recordedBy: true },
        orderBy: { wastageDate: 'desc' },
      }),
      this.prisma.wastageRecord.count(),
    ]);

    return createPaginatedResult(records, page, pageSize, totalItems);
  }

  async findById(id: number) {
    const record = await this.prisma.wastageRecord.findUnique({
      where: { id },
      include: { item: true, lot: true, recordedBy: true, approvedBy: true },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Wastage record not found',
        messageAr: 'سجل الإهدار غير موجود',
      });
    }

    return record;
  }

  async create(dto: any, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      let costPerKg = 0;
      let itemId = dto.itemId;

      if (dto.lotId) {
        const lot = await tx.inventoryLot.findUnique({
          where: { id: dto.lotId },
        });

        if (!lot) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: 'Lot not found',
            messageAr: 'الدفعة غير موجودة',
          });
        }

        if (lot.remainingQuantityGrams < dto.weightGrams) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK',
            message: 'Insufficient stock in lot',
            messageAr: 'المخزون غير كافٍ في الدفعة',
          });
        }

        costPerKg = lot.unitPurchasePrice;
        itemId = lot.itemId;

        // Update lot
        await tx.inventoryLot.update({
          where: { id: dto.lotId },
          data: {
            remainingQuantityGrams: { decrement: dto.weightGrams },
          },
        });
      }

      const estimatedCostValue = Math.round((dto.weightGrams / 1000) * costPerKg);

      // Update inventory
      await tx.inventory.update({
        where: { itemId },
        data: {
          currentQuantityGrams: { decrement: dto.weightGrams },
          totalValue: { decrement: estimatedCostValue },
        },
      });

      // Create wastage record
      const record = await tx.wastageRecord.create({
        data: {
          itemId,
          lotId: dto.lotId,
          weightGrams: dto.weightGrams,
          wastageType: dto.wastageType ?? 'other',
          reason: dto.reason,
          estimatedCostValue,
          photoUrl: dto.photoUrl,
          wastageDate: dto.wastageDate ? new Date(dto.wastageDate) : new Date(),
          notes: dto.notes,
          recordedById: userId,
        },
      });

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          itemId,
          lotId: dto.lotId,
          movementType: 'wastage',
          quantityGrams: -dto.weightGrams,
          unitCost: costPerKg,
          referenceType: 'wastage',
          referenceId: record.id,
          performedById: userId,
        },
      });

      // Create accounting journal entry
      await this.accountingService.createWastageJournalEntry(
        tx,
        record.id,
        dto.branchId ?? null,
        userId,
        estimatedCostValue,
      );

      return record;
    });
  }

  async approve(id: number, userId: number) {
    const record = await this.prisma.wastageRecord.findUnique({ where: { id } });

    if (!record) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Wastage record not found',
        messageAr: 'سجل الإهدار غير موجود',
      });
    }

    return this.prisma.wastageRecord.update({
      where: { id },
      data: {
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }
}
