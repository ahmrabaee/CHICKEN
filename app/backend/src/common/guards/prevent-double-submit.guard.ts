/**
 * PreventDoubleSubmitGuard — Blueprint 03 Posting Workflow Control
 *
 * Prevents creating duplicate GL entries for the same voucher.
 * Call before glEngine.post() to ensure no existing JournalEntry for sourceType+sourceId.
 */

import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class PreventDoubleSubmitGuard {
  /**
   * Throws if a JournalEntry already exists for this voucher.
   * Reversal entries have sourceType='reversal' so they won't match.
   * @param voucherType - e.g. 'sale', 'purchase', 'payment'
   * @param voucherId - The source document ID
   * @param tx - Prisma transaction/client
   */
  static async check(
    voucherType: string,
    voucherId: number,
    tx: PrismaTransaction,
  ): Promise<void> {
    const existing = await tx.journalEntry.findFirst({
      where: {
        sourceType: voucherType,
        sourceId: voucherId,
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'ALREADY_POSTED',
        message: 'Document already has GL entries',
        messageAr: 'المستند مرحّل بالفعل إلى الدفاتر',
      });
    }
  }
}
