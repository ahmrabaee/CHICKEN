import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GLMapEntry, GLPostMetadata } from './types/gl-map.types';
import { PreventGroupPostingGuard } from '../chart-of-accounts/prevent-group-posting.guard';

export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * GL Entry Factory - Blueprint 02
 * Creates JournalEntry and JournalEntryLine from processed GL Map
 */
@Injectable()
export class GlEntryFactory {
  constructor(private preventGroupPostingGuard: PreventGroupPostingGuard) {}

  async createJournalEntryFromGLMap(
    tx: PrismaTransaction,
    glMap: GLMapEntry[],
    metadata: GLPostMetadata,
  ) {
    const accountIds = glMap.map((e) => e.accountId).filter(Boolean);
    await this.preventGroupPostingGuard.validateAccountsForPosting(accountIds);

    const entryNumber = await this.generateEntryNumber(tx);

    const entry = await tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: metadata.postingDate,
        description: metadata.description,
        sourceType: metadata.voucherType,
        sourceId: metadata.voucherId,
        branchId: metadata.branchId,
        isPosted: true,
        createdById: metadata.createdById,
      },
    });

    for (let i = 0; i < glMap.length; i++) {
      const line = glMap[i];
      const debit = line.debit ?? 0;
      const credit = line.credit ?? 0;

      await tx.journalEntryLine.create({
        data: {
          journalEntryId: entry.id,
          lineNumber: i + 1,
          accountId: line.accountId,
          debitAmount: debit,
          creditAmount: credit,
          debitInAccountCurrency: line.debitInAccountCurrency ?? debit,
          creditInAccountCurrency: line.creditInAccountCurrency ?? credit,
          exchangeRate: line.exchangeRate,
          costCenterId: line.costCenterId ?? undefined,
          companyId: metadata.companyId,
          partyType: line.partyType ?? undefined,
          partyId: line.partyId ?? undefined,
          againstVoucherType: line.againstVoucherType ?? undefined,
          againstVoucherId: line.againstVoucherId ?? undefined,
          voucherDetailNo: line.voucherDetailNo ?? undefined,
          description: line.description,
          isOpening: line.isOpening ?? false,
        },
      });
    }

    return entry;
  }

  private async generateEntryNumber(tx: PrismaTransaction): Promise<string> {
    const count = await tx.journalEntry.count();
    return `JE-${(count + 1).toString().padStart(6, '0')}`;
  }
}
