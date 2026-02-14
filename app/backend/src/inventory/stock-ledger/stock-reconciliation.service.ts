import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Blueprint 06: Stock vs GL Reconciliation Report
 * Compares SUM(SLE.stock_value_difference) with GL balance for stock accounts
 */
export interface StockVsGLRow {
  voucherType: string;
  voucherId: number;
  postingDate: Date;
  stockValue: number;
  accountValue: number;
  difference: number;
  ledgerType: 'Stock Ledger Entry' | 'GL Entry (no SLE)';
}

export interface StockVsGLReport {
  asOfDate: Date;
  branchId?: number | null;
  rows: StockVsGLRow[];
  summary: {
    totalStockValue: number;
    totalAccountValue: number;
    totalDifference: number;
  };
}

@Injectable()
export class StockReconciliationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate Stock vs GL comparison report
   */
  async generateStockVsGLReport(
    asOfDate: Date,
    branchId?: number | null,
  ): Promise<StockVsGLReport> {
    // Stock account codes: 1130 (main), 1131, 1132 (per-branch alternatives)
    const stockAccountCodes = ['1130', '1131', '1132'];
    const stockAccounts = await this.prisma.account.findMany({
      where: { code: { in: stockAccountCodes } },
      select: { id: true },
    });
    const stockAccountIds = stockAccounts.map((a) => a.id);
    if (stockAccountIds.length === 0) {
      return { asOfDate, branchId, rows: [], summary: { totalStockValue: 0, totalAccountValue: 0, totalDifference: 0 } };
    }

    // Sum SLE by voucher
    const sleSums = await this.prisma.stockLedgerEntry.groupBy({
      by: ['voucherType', 'voucherId', 'postingDate'],
      where: {
        postingDate: { lte: asOfDate },
        ...(branchId !== undefined && branchId !== null ? { branchId } : {}),
      },
      _sum: { stockValueDifference: true },
    });

    // Get GL sums by source (JournalEntry.sourceType, sourceId)
    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        entryDate: { lte: asOfDate },
        isReversed: false,
        ...(branchId !== undefined && branchId !== null ? { branchId } : {}),
      },
      include: {
        lines: {
          where: { accountId: { in: stockAccountIds } },
          select: {
            debitAmount: true,
            creditAmount: true,
          },
        },
      },
    });

    const glByVoucher = new Map<string, number>();
    for (const je of journalEntries) {
      if (!je.sourceType || je.sourceId == null) continue;
      const key = `${je.sourceType}:${je.sourceId}`;
      const accountValue = je.lines.reduce(
        (sum, l) => sum + l.debitAmount - l.creditAmount,
        0,
      );
      if (accountValue !== 0) {
        glByVoucher.set(key, (glByVoucher.get(key) ?? 0) + accountValue);
      }
    }

    const rows: StockVsGLRow[] = [];
    const seenVouchers = new Set<string>();
    let totalStockValue = 0;
    let totalAccountValue = 0;

    for (const sle of sleSums) {
      const key = `${sle.voucherType}:${sle.voucherId}`;
      seenVouchers.add(key);
      const stockVal = sle._sum.stockValueDifference ?? 0;
      const accountVal = glByVoucher.get(key) ?? 0;
      totalStockValue += stockVal;
      totalAccountValue += accountVal;
      rows.push({
        voucherType: sle.voucherType,
        voucherId: sle.voucherId,
        postingDate: sle.postingDate,
        stockValue: stockVal,
        accountValue: accountVal,
        difference: stockVal - accountVal,
        ledgerType: 'Stock Ledger Entry',
      });
    }

    // GL entries without SLE (potential missing stock movements)
    for (const [key, accountVal] of glByVoucher) {
      if (!seenVouchers.has(key) && accountVal !== 0) {
        const [voucherType, voucherIdStr] = key.split(':');
        const voucherId = parseInt(voucherIdStr, 10);
        const je = journalEntries.find(
          (j) =>
            j.sourceType === voucherType &&
            j.sourceId === voucherId &&
            j.lines.some((l) => l.debitAmount - l.creditAmount !== 0),
        );
        totalAccountValue += accountVal;
        rows.push({
          voucherType,
          voucherId,
          postingDate: je?.entryDate ?? new Date(),
          stockValue: 0,
          accountValue: accountVal,
          difference: -accountVal,
          ledgerType: 'GL Entry (no SLE)',
        });
      }
    }

    rows.sort(
      (a, b) =>
        new Date(b.postingDate).getTime() - new Date(a.postingDate).getTime(),
    );

    return {
      asOfDate,
      branchId,
      rows,
      summary: {
        totalStockValue,
        totalAccountValue,
        totalDifference: totalStockValue - totalAccountValue,
      },
    };
  }
}
