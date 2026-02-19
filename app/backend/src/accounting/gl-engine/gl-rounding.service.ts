import { Injectable } from '@nestjs/common';
import { GLMapEntry } from './types/gl-map.types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GL Rounding Service - Blueprint 02
 * Adds round-off entry when diff is within tolerance but non-zero
 */
@Injectable()
export class GlRoundingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add round-off entry to GL Map
   * @param glMap - mutable array, will be modified
   * @param diff - totalDebit - totalCredit (in minor units)
   * @param precision - currency precision
   * @param companyId - for round_off_account lookup
   */
  async applyRoundOffIfNeeded(
    glMap: GLMapEntry[],
    diff: number,
    precision: number,
    companyId: number | null,
  ): Promise<void> {
    const threshold = 1; // 1 minor unit
    if (Math.abs(diff) < threshold) return;

    const roundOffAccountId = await this.getRoundOffAccountId(companyId);
    if (!roundOffAccountId) {
      // No round-off account configured - allow small diff (already validated)
      return;
    }

    // diff is in minor units - use as is for round-off
    const roundedDiff = Math.abs(diff);

    const roundOffEntry: GLMapEntry = {
      accountId: roundOffAccountId,
      skipMerge: true,
      isRoundOff: true,
      description: 'تدوير تقريبي',
    };

    if (diff > 0) {
      roundOffEntry.credit = roundedDiff;
    } else {
      roundOffEntry.debit = roundedDiff;
    }

    glMap.push(roundOffEntry);
  }

  private async getRoundOffAccountId(companyId: number | null): Promise<number | null> {
    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { roundOffAccountId: true },
      });
      if (company?.roundOffAccountId) return company.roundOffAccountId;
    }

    // Fallback: first company's round-off account or system setting
    const company = await this.prisma.company.findFirst({
      where: { roundOffAccountId: { not: null } },
      select: { roundOffAccountId: true },
    });
    return company?.roundOffAccountId ?? null;
  }
}
