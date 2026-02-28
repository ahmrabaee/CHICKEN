/**
 * Accounting Module Types
 * Blueprint 01: Chart of Accounts Rebuild
 */

export interface Account {
    id: number;
    code: string;
    name: string;
    nameEn?: string;
    rootType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
    reportType: 'Balance Sheet' | 'Profit and Loss';
    accountType: string;
    parentId?: number | null;
    lft: number;
    rgt: number;
    isGroup: boolean;
    balanceMustBe?: 'Debit' | 'Credit' | null;
    accountCurrency?: string | null;
    companyId?: number | null;
    isActive: boolean;
    isSystemAccount?: boolean;
    freezeAccount?: boolean;
    parent?: { id: number; code: string; name: string } | null;
    childAccounts?: { id: number; code: string; name: string }[];
    balance?: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAccountDto {
    code: string;
    name: string;
    nameEn?: string;
    rootType?: string;
    reportType?: string;
    accountType: string;
    parentId?: number | null;
    isGroup?: boolean;
    balanceMustBe?: 'Debit' | 'Credit' | null;
    accountCurrency?: string | null;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {
    isActive?: boolean;
    freezeAccount?: boolean;
}

export interface CanDeleteAccountResponse {
    canDelete: boolean;
    hasEntries?: boolean;
    hasChildren?: boolean;
}

export interface JournalEntryLine {
    id: number;
    accountId: number;
    account?: { id: number; code: string; name: string; rootType?: string; accountCurrency?: string | null };
    accountName?: string;
    accountCode?: string;
    debit?: number;
    credit?: number;
    debitAmount?: number;
    creditAmount?: number;
    // Blueprint 02: multi-currency & GL fields
    debitInAccountCurrency?: number | null;
    creditInAccountCurrency?: number | null;
    exchangeRate?: number | null;
    costCenterId?: number | null;
    costCenter?: { id: number; code: string; name: string } | null;
    partyType?: string | null;
    partyId?: number | null;
    partyName?: string | null;
    againstVoucherType?: string | null;
    againstVoucherId?: number | null;
    voucherDetailNo?: string | null;
    description?: string;
    isOpening?: boolean;
    isRoundOff?: boolean; // لاحقاً عند إضافته في الـ backend
}

export interface JournalEntry {
    id: number;
    entryNumber: string;
    entryDate: string;
    description: string;
    referenceType?: string;
    referenceId?: number;
    status?: 'draft' | 'posted';
    isPosted?: boolean;
    totalDebit?: number;
    totalCredit?: number;
    createdAt: string;
    postedAt?: string;
    createdById?: number;
    lines: JournalEntryLine[];
    /** Blueprint 03: Reversal tracking */
    isReversed?: boolean;
    reversedByEntryId?: number;
    reversedByEntry?: JournalEntry;
    /** Source: 'payment', 'sale', 'reversal', etc. */
    sourceType?: string;
    /** ID of source document (payment, sale, or original entry for reversal) */
    sourceId?: number;
    /** When sourceType=payment: party name (customer/supplier) */
    sourcePartyName?: string | null;
    sourcePartyType?: string | null;
    /** When sourceType=expense: expense category name (e.g. إيجار) */
    sourceExpenseCategoryName?: string | null;
}

export interface CreateJournalEntryLineDto {
    accountId: number;
    debit?: number;
    credit?: number;
    description?: string;
}

export interface CreateJournalEntryDto {
    description: string;
    entryDate?: string;
    referenceType?: string;
    referenceId?: number;
    lines: CreateJournalEntryLineDto[];
}

export interface TrialBalanceEntry {
    accountId: number;
    accountCode: string;
    accountName: string;
    accountType: string;
    debit: number;
    credit: number;
}

export interface LedgerEntry {
    id: number;
    entryDate: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    entryNumber?: string;
    /** Bank name when transaction is from bank transfer (payment) */
    bankName?: string | null;
}
