
import { useQuery } from '@tanstack/react-query';
import { debtService } from '@/services/debt.service';
import { DebtQuery } from '@/types/debts';

export const useReceivables = (params?: DebtQuery) => {
    return useQuery({
        queryKey: ['debts', 'receivables', params],
        queryFn: () => debtService.getReceivables(params),
    });
};

export const usePayables = (params?: DebtQuery) => {
    return useQuery({
        queryKey: ['debts', 'payables', params],
        queryFn: () => debtService.getPayables(params),
    });
};

export const useDebtSummary = () => {
    return useQuery({
        queryKey: ['debts', 'summary'],
        queryFn: () => debtService.getSummary(),
    });
};

export const useOverdueDebts = () => {
    return useQuery({
        queryKey: ['debts', 'overdue'],
        queryFn: () => debtService.getOverdue(),
    });
};

export const useDebt = (id: number) => {
    return useQuery({
        queryKey: ['debts', id],
        queryFn: () => debtService.getDebt(id),
        enabled: !!id,
    });
};
