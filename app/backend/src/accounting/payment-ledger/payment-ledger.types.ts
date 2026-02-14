/**
 * Blueprint 04: Payment Ledger (Receivables/Payables Subledger)
 * Types for PLE creation and outstanding calculation
 */

export type PartyType = 'customer' | 'supplier';
export type AccountType = 'receivable' | 'payable';
export type VoucherType = 'sale' | 'purchase' | 'payment' | 'credit_note';

export interface CreatePLEInput {
  partyType: PartyType;
  partyId: number;
  accountType: AccountType;
  accountId: number;
  voucherType: VoucherType;
  voucherId: number;
  againstVoucherType?: VoucherType | null;
  againstVoucherId?: number | null;
  amount: number; // + for invoice (increase AR/AP), - for payment (decrease)
  postingDate: Date;
  dueDate?: Date | null;
  remarks?: string | null;
}
