
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingService } from '@/services/accounting.service';
import { CreateAccountDto, UpdateAccountDto, CreateJournalEntryDto } from '@/types/accounting';
import { toast } from '@/hooks/use-toast';

export const useAccounts = (postableOnly?: boolean) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', postableOnly],
        queryFn: () => accountingService.getAccounts(postableOnly),
    });
};

export const useAccount = (idOrCode: string | number) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', idOrCode],
        queryFn: () =>
            typeof idOrCode === 'number'
                ? accountingService.getAccountById(idOrCode)
                : accountingService.getAccountByCode(idOrCode),
        enabled: idOrCode !== '' && idOrCode != null,
    });
};

export const useCanDeleteAccount = (id: number) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', id, 'can-delete'],
        queryFn: () => accountingService.canDeleteAccount(id),
        enabled: !!id,
    });
};

export const useCreateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateAccountDto) => accountingService.createAccount(data),
        onSuccess: async (newAccount) => {
            if (newAccount) {
                const queryKey = ['accounting', 'accounts', undefined] as const;
                queryClient.setQueryData(queryKey, (old: { data?: unknown[] } | undefined) => {
                    if (!old) return old;
                    const list = Array.isArray(old?.data) ? [...old.data] : [];
                    if (list.some((a: { id?: number }) => a.id === newAccount.id)) return old;
                    return { ...old, data: [...list, newAccount] };
                });
            }
            await queryClient.refetchQueries({ queryKey: ['accounting', 'accounts'] });
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
        mutationFn: ({ id, data }: { id: number; data: UpdateAccountDto }) => accountingService.updateAccount(id, data),
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ['accounting', 'accounts'] });
            toast({ title: 'تم تحديث الحساب بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useDeleteAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => accountingService.deleteAccount(id),
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ['accounting', 'accounts'] });
            toast({ title: 'تم حذف الحساب بنجاح' });
        },
        onError: (error: any) => {
            const code = error.response?.data?.code;
            const messageAr = error.response?.data?.messageAr;
            toast({
                variant: 'destructive',
                title: 'خطأ',
                description: messageAr || error.response?.data?.message || 'حدث خطأ',
            });
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
            const code = error.response?.data?.code;
            const data = error.response?.data;
            const messageAr = data?.messageAr || error.response?.data?.message;
            let title = 'خطأ';
            if (code === 'UNBALANCED_ENTRY') {
                title = data?.diff != null
                    ? `القيد غير متوازن (الفرق: ${(data.diff / 100).toFixed(2)} ₪)`
                    : 'القيد غير متوازن';
            } else if (code === 'POSTING_TO_GROUP_ACCOUNT') title = 'لا يمكن القيد على حسابات المجموعة';
            else if (code === 'POSTING_TO_DISABLED_ACCOUNT') title = 'لا يمكن القيد على حسابات معطلة';
            else if (code === 'POSTING_TO_FROZEN_ACCOUNT') title = 'لا يمكن القيد على حسابات مجمدة';
            else if (code === 'ALREADY_REVERSED') title = 'القيد معكوس بالفعل';
            toast({
                variant: 'destructive',
                title,
                description: messageAr,
            });
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
