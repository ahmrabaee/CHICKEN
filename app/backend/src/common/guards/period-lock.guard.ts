/**
 * PeriodLockGuard — Blueprint 03 Posting Workflow Control
 *
 * Prevents Submit/Cancel when posting date falls in:
 * 1. A closed accounting period
 * 2. Before the accounting freeze date
 */

import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class PeriodLockGuard {
  /**
   * Checks if posting is allowed for the given date.
   * @param postingDate - The date of the transaction
   * @param companyId - Optional company (null for single-entity)
   * @param tx - Prisma transaction/client
   * @throws BadRequestException with code FREEZE_DATE or PERIOD_LOCKED
   */
  static async check(
    postingDate: Date,
    companyId: number | null | undefined,
    tx: PrismaTransaction,
  ): Promise<void> {
    const settings = await this.getSystemSettings(tx);

    // Check freeze date: no posting before this date
    if (settings.accounting_freeze_date) {
      const freeze = new Date(settings.accounting_freeze_date);
      if (postingDate < freeze) {
        throw new BadRequestException({
          code: 'FREEZE_DATE',
          message: 'Posting date is before accounting freeze date',
          messageAr: 'التاريخ قبل تاريخ التجميد المحاسبي',
        });
      }
    }

    // Check period lock: no posting in closed periods
    if (settings.period_lock_enabled === 'true') {
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId: companyId ?? null,
          startDate: { lte: postingDate },
          endDate: { gte: postingDate },
          isClosed: true,
        },
      });
      if (period) {
        throw new BadRequestException({
          code: 'PERIOD_LOCKED',
          message: 'Accounting period is closed',
          messageAr: 'الفترة المحاسبية مغلقة',
        });
      }
    }
  }

  private static async getSystemSettings(tx: PrismaTransaction) {
    const rows = await tx.systemSetting.findMany({
      where: {
        key: { in: ['period_lock_enabled', 'accounting_freeze_date'] },
      },
    });
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return {
      period_lock_enabled: map['period_lock_enabled'] ?? 'false',
      accounting_freeze_date: map['accounting_freeze_date'] || null,
    };
  }
}
