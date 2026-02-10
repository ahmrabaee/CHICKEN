
/**
 * Accounting Module Types
 */

export interface Account {
    id: number;
    code: string;
    name: string;
    nameAr?: string;
    accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    balance: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAccountDto {
    code: string;
    name: string;
    nameAr?: string;
    accountType: string;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {
    isActive?: boolean;
}

export interface JournalEntryLine {
    id: number;
    accountId: number;
    accountName?: string;
    accountCode?: string;
    debit: number;
    credit: number;
    description?: string;
}

export interface JournalEntry {
    id: number;
    entryNumber: string;
    entryDate: string;
    description: string;
    referenceType?: string;
    referenceId?: number;
    status: 'draft' | 'posted';
    totalDebit: number;
    totalCredit: number;
    createdAt: string;
    postedAt?: string;
    createdById?: number;
    lines: JournalEntryLine[];
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
}
