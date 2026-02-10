
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseService } from '@/services/expense.service';
import { ExpenseQuery, CreateExpenseDto, UpdateExpenseDto } from '@/types/expenses';
import { toast } from '@/hooks/use-toast';

export const useExpenses = (params?: ExpenseQuery) => {
    return useQuery({
        queryKey: ['expenses', params],
        queryFn: () => expenseService.getExpenses(params),
    });
};

export const useExpense = (id: number) => {
    return useQuery({
        queryKey: ['expenses', id],
        queryFn: () => expenseService.getExpense(id),
        enabled: !!id,
    });
};

export const useExpenseCategories = () => {
    return useQuery({
        queryKey: ['expenses', 'categories'],
        queryFn: () => expenseService.getCategories(),
    });
};

export const useExpenseSummary = () => {
    return useQuery({
        queryKey: ['expenses', 'summary'],
        queryFn: () => expenseService.getSummary(),
    });
};

export const useCreateExpense = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateExpenseDto) => expenseService.createExpense(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({ title: 'تم إضافة المصروف بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ في إضافة المصروف', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useUpdateExpense = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateExpenseDto }) => expenseService.updateExpense(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({ title: 'تم تحديث المصروف بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ في تحديث المصروف', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useDeleteExpense = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => expenseService.deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({ title: 'تم حذف المصروف بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ في حذف المصروف', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useApproveExpense = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => expenseService.approveExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({ title: 'تمت الموافقة على المصروف' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ في الموافقة', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};
