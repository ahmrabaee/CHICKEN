
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '@/services/payment.service';
import { PaymentQuery, RecordSalePaymentDto, RecordPurchasePaymentDto } from '@/types/payments';
import { toast } from '@/hooks/use-toast';

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
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الدفعة', description: error.response?.data?.message || 'حدث خطأ' });
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
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الدفعة', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};
