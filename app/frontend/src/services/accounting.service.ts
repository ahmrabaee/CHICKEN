import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Account, CreateAccountDto, UpdateAccountDto, CanDeleteAccountResponse,
    JournalEntry, CreateJournalEntryDto,
    TrialBalanceEntry, LedgerEntry,
} from '@/types/accounting';

export const accountingService = {
    // Chart of Accounts
    async getAccounts(postableOnly?: boolean): Promise<ApiResponse<Account[]>> {
        const params = postableOnly ? { postableOnly: 'true' } : undefined;
        const response = await axiosInstance.get<ApiResponse<Account[]>>('/accounting/accounts', { params });
        return response.data;
    },
    async getAccountById(id: number): Promise<Account> {
        const response = await axiosInstance.get<ApiResponse<Account>>(`/accounting/accounts/${id}`);
        return response.data.data;
    },
    async getAccountByCode(code: string): Promise<Account> {
        const response = await axiosInstance.get<ApiResponse<Account>>(`/accounting/accounts/code/${code}`);
        return response.data.data;
    },
    async createAccount(data: CreateAccountDto): Promise<Account> {
        const response = await axiosInstance.post<ApiResponse<Account>>('/accounting/accounts', data);
        return response.data.data;
    },
    async updateAccount(id: number, data: UpdateAccountDto): Promise<Account> {
        const response = await axiosInstance.put<ApiResponse<Account>>(`/accounting/accounts/${id}`, data);
        return response.data.data;
    },
    async deleteAccount(id: number): Promise<void> {
        await axiosInstance.delete(`/accounting/accounts/${id}`);
    },
    async canDeleteAccount(id: number): Promise<CanDeleteAccountResponse> {
        const response = await axiosInstance.get<ApiResponse<CanDeleteAccountResponse>>(`/accounting/accounts/${id}/can-delete`);
        return response.data.data;
    },
    // Journal Entries
    async getJournalEntries(params?: { page?: number; pageSize?: number }): Promise<ApiResponse<JournalEntry[]>> {
        const response = await axiosInstance.get<ApiResponse<JournalEntry[]>>('/accounting/journal-entries', { params });
        return response.data;
    },
    async getJournalEntry(id: number): Promise<JournalEntry> {
        const response = await axiosInstance.get<ApiResponse<JournalEntry>>(`/accounting/journal-entries/${id}`);
        return response.data.data;
    },
    async createJournalEntry(data: CreateJournalEntryDto): Promise<JournalEntry> {
        const response = await axiosInstance.post<ApiResponse<JournalEntry>>('/accounting/journal-entries', data);
        return response.data.data;
    },
    async postJournalEntry(id: number): Promise<JournalEntry> {
        const response = await axiosInstance.post<ApiResponse<JournalEntry>>(`/accounting/journal-entries/${id}/post`);
        return response.data.data;
    },
    // Reports
    async getTrialBalance(): Promise<TrialBalanceEntry[]> {
        const response = await axiosInstance.get<ApiResponse<TrialBalanceEntry[]>>('/accounting/trial-balance');
        return response.data.data;
    },
    async getAccountLedger(accountCode: string, params?: { startDate?: string; endDate?: string }): Promise<LedgerEntry[]> {
        const response = await axiosInstance.get<ApiResponse<LedgerEntry[]>>(`/accounting/ledger/${accountCode}`, { params });
        return response.data.data;
    },
};
