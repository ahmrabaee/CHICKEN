
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingService } from '@/services/accounting.service';
import { CreateAccountDto, UpdateAccountDto, CreateJournalEntryDto } from '@/types/accounting';
import { toast } from '@/hooks/use-toast';

export const useAccounts = () => {
    return useQuery({
        queryKey: ['accounting', 'accounts'],
        queryFn: () => accountingService.getAccounts(),
    });
};

export const useAccount = (code: string) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', code],
        queryFn: () => accountingService.getAccountByCode(code),
        enabled: !!code,
    });
};

export const useCreateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateAccountDto) => accountingService.createAccount(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] });
            toast({ title: 'تم إنشاء الحساب بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useUpdateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ code, data }: { code: string; data: UpdateAccountDto }) => accountingService.updateAccount(code, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] });
            toast({ title: 'تم تحديث الحساب بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useJournalEntries = (params?: { page?: number; pageSize?: number }) => {
    return useQuery({
        queryKey: ['accounting', 'journal-entries', params],
        queryFn: () => accountingService.getJournalEntries(params),
    });
};

export const useJournalEntry = (id: number) => {
    return useQuery({
        queryKey: ['accounting', 'journal-entries', id],
        queryFn: () => accountingService.getJournalEntry(id),
        enabled: !!id,
    });
};

export const useCreateJournalEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateJournalEntryDto) => accountingService.createJournalEntry(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'journal-entries'] });
            toast({ title: 'تم إنشاء القيد بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const usePostJournalEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => accountingService.postJournalEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'journal-entries'] });
            toast({ title: 'تم ترحيل القيد بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useTrialBalance = () => {
    return useQuery({
        queryKey: ['accounting', 'trial-balance'],
        queryFn: () => accountingService.getTrialBalance(),
    });
};

export const useAccountLedger = (code: string, params?: { startDate?: string; endDate?: string }) => {
    return useQuery({
        queryKey: ['accounting', 'ledger', code, params],
        queryFn: () => accountingService.getAccountLedger(code, params),
        enabled: !!code,
    });
};
