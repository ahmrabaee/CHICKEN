import { Injectable } from '@nestjs/common';
import { GLMapEntry } from './types/gl-map.types';

const MERGE_PROPERTIES = [
  'accountId',
  'costCenterId',
  'partyType',
  'partyId',
  'againstVoucherType',
  'againstVoucherId',
  'voucherDetailNo',
] as const;

/**
 * GL Merger Service - Blueprint 02
 * Merges similar entries, normalizes negative debit/credit
 */
@Injectable()
export class GlMergerService {
  /**
   * Build merge key from entry properties
   */
  private getMergeKey(entry: GLMapEntry): string {
    const parts = MERGE_PROPERTIES.map((p) => {
      const v = entry[p];
      return v === null || v === undefined ? '_' : String(v);
    });
    return parts.join('|');
  }

  /**
   * Merge entries with same account, cost center, party, etc.
   */
  mergeSimilarEntries(glMap: GLMapEntry[]): GLMapEntry[] {
    const merged = new Map<string, GLMapEntry>();

    for (const entry of glMap) {
      if (entry.skipMerge) {
        merged.set(`skip_${entry.accountId}_${Math.random().toString(36).slice(2)}`, { ...entry });
        continue;
      }

      const key = this.getMergeKey(entry);
      const existing = merged.get(key);
      if (existing) {
        existing.debit = (existing.debit ?? 0) + (entry.debit ?? 0);
        existing.credit = (existing.credit ?? 0) + (entry.credit ?? 0);
        existing.debitInAccountCurrency =
          (existing.debitInAccountCurrency ?? 0) + (entry.debitInAccountCurrency ?? 0);
        existing.creditInAccountCurrency =
          (existing.creditInAccountCurrency ?? 0) + (entry.creditInAccountCurrency ?? 0);
        existing.debitInTransactionCurrency =
          (existing.debitInTransactionCurrency ?? 0) + (entry.debitInTransactionCurrency ?? 0);
        existing.creditInTransactionCurrency =
          (existing.creditInTransactionCurrency ?? 0) + (entry.creditInTransactionCurrency ?? 0);
      } else {
        merged.set(key, { ...entry });
      }
    }

    return [...merged.values()].filter(
      (e) => Math.abs(e.debit ?? 0) > 0 || Math.abs(e.credit ?? 0) > 0,
    );
  }

  /**
   * Normalize: if debit and credit both negative and equal, swap to positive
   * If debit negative: move to credit. If credit negative: move to debit.
   */
  toggleDebitCreditIfNegative(glMap: GLMapEntry[]): GLMapEntry[] {
    return glMap.map((e) => {
      const debit = e.debit ?? 0;
      const credit = e.credit ?? 0;

      if (debit < 0 && credit < 0 && debit === credit) {
        return { ...e, debit: Math.abs(debit), credit: 0 };
      }
      if (debit < 0) {
        return { ...e, debit: 0, credit: (e.credit ?? 0) + Math.abs(debit) };
      }
      if (credit < 0) {
        return { ...e, debit: (e.debit ?? 0) + Math.abs(credit), credit: 0 };
      }
      return e;
    });
  }
}
