import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCOUNT_CODES } from '../../accounting/accounting.service';

/**
 * Blueprint 06: Branch/Warehouse → Account mapping
 * Returns the stock account ID for a branch. Fallback to default inventory account (1130) if not set.
 */
@Injectable()
export class StockAccountMapperService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get stock account ID for a branch. Returns account ID (for JournalEntryLine) or null to use code.
   * The accounting service uses account codes - we return the code string for compatibility.
   * MUST return a leaf account (isGroup=false) - group accounts cannot receive postings.
   */
  async getStockAccountCode(branchId: number | null): Promise<string> {
    if (!branchId) {
      return ACCOUNT_CODES.INVENTORY;
    }
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { stockAccount: true },
    });
    if (branch?.stockAccountId && branch.stockAccount && !branch.stockAccount.isGroup) {
      return branch.stockAccount.code;
    }
    // Fallback: branch has no stock account, or it's a group (e.g. 1130) - use default leaf 1131
    return ACCOUNT_CODES.INVENTORY;
  }

  /**
   * Get stock account ID (numeric) for a branch - for direct account reference if needed
   */
  async getStockAccountId(branchId: number | null): Promise<number | null> {
    if (!branchId) return null;
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { stockAccountId: true },
    });
    return branch?.stockAccountId ?? null;
  }
}
