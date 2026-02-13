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
    const lotId = dto.lotId != null ? Number(dto.lotId) : null;
    if (!lotId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'lotId is required',
        messageAr: 'الدفعة مطلوبة',
      });
    }

    const branchId = dto.branchId != null ? Number(dto.branchId) : null;
    if (!branchId) {
        throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'branchId is required',
            messageAr: 'الفرع مطلوب',
        });
    }

    const weightGrams = Math.round(Number(dto.quantityGrams ?? dto.weightGrams ?? 0));
    if (!weightGrams || weightGrams <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Quantity (grams) is required and must be positive',
        messageAr: 'الكمية (غرام) مطلوبة ويجب أن تكون موجبة',
      });
    }

    const recordedById = Number(userId);
    if (!recordedById || Number.isNaN(recordedById)) {
      throw new BadRequestException({
        code: 'UNAUTHORIZED',
        message: 'User context required',
        messageAr: 'يجب تسجيل الدخول',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.inventoryLot.findUnique({
        where: { id: lotId },
      });

      if (!lot) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Lot not found',
          messageAr: 'الدفعة غير موجودة',
        });
      }

      if (lot.remainingQuantityGrams < weightGrams) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock in lot',
          messageAr: 'المخزون غير كافٍ في الدفعة',
        });
      }

      const itemId = lot.itemId;
      const costPerKg = lot.unitPurchasePrice ?? 0;

      await tx.inventoryLot.update({
        where: { id: lotId },
        data: {
          remainingQuantityGrams: { decrement: weightGrams },
        },
      });

      const estimatedCostValue = Math.round((weightGrams / 1000) * costPerKg);

      await tx.inventory.update({
        where: { itemId },
        data: {
          currentQuantityGrams: { decrement: weightGrams },
          totalValue: { decrement: estimatedCostValue },
        },
      });

      const wastageType = (dto.wastageType ?? dto.reason ?? 'other').toString();
      const reason = (dto.reason ?? 'other').toString();
      const record = await tx.wastageRecord.create({
        data: {
          branchId,
          itemId,
          lotId,
          weightGrams,
          wastageType,
          reason,
          estimatedCostValue,
          photoUrl: dto.photoUrl ?? null,
          wastageDate: dto.wastageDate ? new Date(dto.wastageDate) : new Date(),
          notes: dto.notes != null && dto.notes !== '' ? String(dto.notes) : null,
          recordedById,
        },
      });

      await tx.stockMovement.create({
        data: {
          branchId,
          itemId,
          lotId,
          movementType: 'wastage',
          quantityGrams: -weightGrams,
          unitCost: costPerKg,
          referenceType: 'wastage',
          referenceId: record.id,
          performedById: recordedById,
        },
      });

      await this.accountingService.createWastageJournalEntry(
        tx,
        record.id,
        dto.branchId != null ? Number(dto.branchId) : null,
        recordedById,
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
