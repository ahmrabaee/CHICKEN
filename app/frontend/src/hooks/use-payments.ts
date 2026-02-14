import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '@/services/payment.service';
import {
    PaymentQuery,
    RecordSalePaymentDto,
    RecordPurchasePaymentDto,
    CancelPaymentDto,
    CreateAdvancePaymentDto,
} from '@/types/payments';
import { toast } from '@/hooks/use-toast';
import { getPostingErrorToast } from '@/lib/api-errors';

export const usePayments = (params?: PaymentQuery) => {
    return useQuery({
        queryKey: ['payments', params],
        queryFn: () => paymentService.getPayments(params),
    });
};

export const usePayment = (id: number) => {
    return useQuery({
        queryKey: ['payments', id],
        queryFn: () => paymentService.getPayment(id),
        enabled: !!id,
    });
};

export const useRecordSalePayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: RecordSalePaymentDto) => paymentService.recordSalePayment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            toast({ title: 'تم تسجيل الدفعة بنجاح' });
        },
        onError: (error: any) => {
            const err = error.response?.data?.error || error.response?.data;
            const desc = err?.messageAr ?? err?.message ?? 'حدث خطأ';
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الدفعة', description: desc });
        },
    });
};

export const useRecordPurchasePayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: RecordPurchasePaymentDto) => paymentService.recordPurchasePayment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            toast({ title: 'تم تسجيل الدفعة بنجاح' });
        },
        onError: (error: any) => {
            const err = error.response?.data?.error || error.response?.data;
            const desc = err?.messageAr ?? err?.message ?? 'حدث خطأ';
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الدفعة', description: desc });
        },
    });
};

export const useCreateAdvancePayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateAdvancePaymentDto) => paymentService.createAdvancePayment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            toast({ title: 'تم تسجيل الدفعة المسبقة بنجاح' });
        },
        onError: (error: any) => {
            const postingToast = getPostingErrorToast(error);
            if (postingToast) {
                toast(postingToast);
                return;
            }
            const err = error.response?.data?.error || error.response?.data;
            const desc = err?.messageAr ?? err?.message ?? 'حدث خطأ';
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الدفعة المسبقة', description: desc });
        },
    });
};

export const useCancelPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: CancelPaymentDto }) =>
            paymentService.cancelPayment(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['payments', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            toast({ title: 'تم إلغاء الدفعة بنجاح' });
        },
        onError: (error: any) => {
            const postingToast = getPostingErrorToast(error);
            if (postingToast) {
                toast(postingToast);
                return;
            }
            toast({
                variant: 'destructive',
                title: 'خطأ في إلغاء الدفعة',
                description: error.response?.data?.messageAr || error.response?.data?.message || 'حدث خطأ',
            });
        },
    });
};
