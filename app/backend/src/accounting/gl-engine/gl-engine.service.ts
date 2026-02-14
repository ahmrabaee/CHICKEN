import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GLMapEntry, GLPostMetadata } from './types/gl-map.types';
import { GlValidatorService } from './gl-validator.service';
import { GlRoundingService } from './gl-rounding.service';
import { GlMergerService } from './gl-merger.service';
import { GlEntryFactory } from './gl-entry.factory';

export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * GL Engine Service - Blueprint 02
 * Main entry point: post(glMap, metadata) and reverse(voucherType, voucherId)
 */
@Injectable()
export class GlEngineService {
  constructor(
    private prisma: PrismaService,
    private glValidator: GlValidatorService,
    private glRounding: GlRoundingService,
    private glMerger: GlMergerService,
    private glEntryFactory: GlEntryFactory,
  ) {}

  /**
   * Post GL Map to ledger
   * Flow: validate -> toggle negative -> merge -> validate again -> round-off if needed -> create JournalEntry
   */
  async post(
    glMap: GLMapEntry[],
    metadata: GLPostMetadata,
    tx?: PrismaTransaction,
  ) {
    const run = async (t: PrismaTransaction) => {
      const precision = await this.getPrecision(metadata.companyId);
      const processed = await this.processGLMap(glMap, metadata, precision, t);
      return this.glEntryFactory.createJournalEntryFromGLMap(t, processed, metadata);
    };

    if (tx) {
      return run(tx);
    }
    return this.prisma.$transaction(run);
  }

  /**
   * Process GL Map: normalize negatives, merge, validate, round-off
   */
  private async processGLMap(
    glMap: GLMapEntry[],
    metadata: GLPostMetadata,
    precision: number,
    tx: PrismaTransaction,
  ): Promise<GLMapEntry[]> {
    let processed = this.glMerger.toggleDebitCreditIfNegative([...glMap]);
    processed = this.glMerger.mergeSimilarEntries(processed);

    let validation = this.glValidator.validateBalance(
      processed,
      precision,
      metadata.voucherType,
    );

    if (validation.needsRoundOff) {
      await this.glRounding.applyRoundOffIfNeeded(
        processed,
        validation.diff,
        precision,
        metadata.companyId,
      );
      validation = this.glValidator.validateBalance(
        processed,
        precision,
        metadata.voucherType,
      );
    }

    return processed;
  }

  /**
   * Reverse GL entries for a voucher
   */
  async reverse(
    voucherType: string,
    voucherId: number,
    userId: number,
    tx?: PrismaTransaction,
  ) {
    const run = async (t: PrismaTransaction) => {
      const original = await t.journalEntry.findFirst({
        where: { sourceType: voucherType, sourceId: voucherId },
        include: { lines: true },
      });

      if (!original) {
        throw new NotFoundException({
          code: 'JOURNAL_ENTRY_NOT_FOUND',
          message: `No journal entry found for ${voucherType} #${voucherId}`,
          messageAr: 'لم يُعثر على قيد محاسبي لهذا المستند',
        });
      }

      if (original.isReversed) {
        throw new BadRequestException({
          code: 'ALREADY_REVERSED',
          message: 'Journal entry is already reversed',
          messageAr: 'القيد معكوس بالفعل',
        });
      }

      const glMap: GLMapEntry[] = original.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.creditAmount,
        credit: l.debitAmount,
        debitInAccountCurrency: l.creditInAccountCurrency ?? undefined,
        creditInAccountCurrency: l.debitInAccountCurrency ?? undefined,
        costCenterId: l.costCenterId ?? undefined,
        partyType: l.partyType ?? undefined,
        partyId: l.partyId ?? undefined,
        description: `عكس: ${l.description ?? original.description}`,
      }));

      const reversal = await this.post(
        glMap,
        {
          voucherType: 'reversal',
          voucherId: original.id,
          postingDate: new Date(),
          companyId: null,
          branchId: original.branchId,
          description: `عكس: ${original.description}`,
          createdById: userId,
        },
        t,
      );

      await t.journalEntry.update({
        where: { id: original.id },
        data: { isReversed: true, reversedByEntryId: reversal.id },
      });

      return reversal;
    };

    if (tx) {
      return run(tx);
    }
    return this.prisma.$transaction(run);
  }

  private async getPrecision(companyId: number | null): Promise<number> {
    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { currencyPrecision: true },
      });
      if (company?.currencyPrecision != null) return company.currencyPrecision;
    }

    const company = await this.prisma.company.findFirst({
      select: { currencyPrecision: true },
    });
    return company?.currencyPrecision ?? 2;
  }
}
