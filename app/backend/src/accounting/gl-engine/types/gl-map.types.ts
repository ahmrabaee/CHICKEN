/**
 * GL Map Types - Blueprint 02 General Ledger Engine
 * Intermediate representation before persisting to JournalEntry/JournalEntryLine
 */

export interface GLMapEntry {
  accountId: number;
  debit?: number;
  credit?: number;
  debitInAccountCurrency?: number;
  creditInAccountCurrency?: number;
  debitInTransactionCurrency?: number;
  creditInTransactionCurrency?: number;
  accountCurrency?: string;
  transactionCurrency?: string;
  exchangeRate?: number;
  costCenterId?: number | null;
  partyType?: string | null;
  partyId?: number | null;
  description?: string;
  againstVoucherType?: string | null;
  againstVoucherId?: number | null;
  voucherDetailNo?: string | null;
  isOpening?: boolean;
  skipMerge?: boolean;
  /** Blueprint 02: Round-off line indicator for UI */
  isRoundOff?: boolean;
}

export interface GLPostMetadata {
  voucherType: string;
  voucherId: number;
  voucherNumber?: string;
  postingDate: Date;
  companyId: number | null;
  branchId: number | null;
  description: string;
  createdById: number;
  updateOutstanding?: boolean;
}
