import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Blueprint 06: Stock Ledger Entry (SLE) - immutable accounting ledger for inventory
 * Every stock movement with accounting impact creates an SLE.
 * SLE is the source of truth for stock valuation; links to GL via voucher_type/voucher_id
 */
export interface CreateSLEInput {
  itemId: number;
  branchId: number | null;
  voucherType: string; // 'sale', 'purchase', 'adjustment', 'wastage', 'transfer'
  voucherId: number;
  voucherDetailNo?: string;
  qtyChange: number; // positive=in, negative=out (grams)
  valuationRate: number; // minor units per kg
  stockValueDifference: number; // minor units
  postingDate: Date;
  postingTime?: string;
  remarks?: string;
}

@Injectable()
export class StockLedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create Stock Ledger Entry (immutable - no update/delete)
   */
  async createSLE(tx: any, input: CreateSLEInput) {
    const prisma = tx ?? this.prisma;
    return prisma.stockLedgerEntry.create({
      data: {
        itemId: input.itemId,
        branchId: input.branchId,
        voucherType: input.voucherType,
        voucherId: input.voucherId,
        voucherDetailNo: input.voucherDetailNo,
        qtyChange: input.qtyChange,
        valuationRate: input.valuationRate,
        stockValueDifference: input.stockValueDifference,
        postingDate: input.postingDate,
        postingTime: input.postingTime,
        remarks: input.remarks,
      },
    });
  }

  /**
   * Sum stock_value_difference for a voucher (for reconciliation)
   */
  async sumByVoucher(
    tx: any,
    voucherType: string,
    voucherId: number,
    branchId?: number | null,
  ): Promise<number> {
    const prisma = tx ?? this.prisma;
    const result = await prisma.stockLedgerEntry.aggregate({
      where: {
        voucherType,
        voucherId,
        ...(branchId !== undefined && branchId !== null ? { branchId } : {}),
      },
      _sum: { stockValueDifference: true },
    });
    return result._sum?.stockValueDifference ?? 0;
  }
}
