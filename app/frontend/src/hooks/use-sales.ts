
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesService } from '@/services/sales.service';
import { SaleQuery, CreateSaleDto, VoidSaleDto, AddPaymentDto } from '@/types/sales';
import { toast } from '@/hooks/use-toast';

/**
 * Sales Query Hooks
 */
export const useSales = (params?: SaleQuery) => {
    return useQuery({
        queryKey: ['sales', params],
        queryFn: () => salesService.getSales(params),
    });
};

export const useSale = (id: number) => {
    return useQuery({
        queryKey: ['sales', id],
        queryFn: () => salesService.getSale(id),
        enabled: !!id,
    });
};

export const useSaleReceipt = (id: number) => {
    return useQuery({
        queryKey: ['sales', id, 'receipt'],
        queryFn: () => salesService.getReceipt(id),
        enabled: !!id,
    });
};

/**
 * Sales Mutation Hooks
 */
export const useCreateSale = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateSaleDto) => salesService.createSale(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast({ title: 'تم إنشاء الفاتورة بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في إنشاء الفاتورة',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};

export const useVoidSale = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: VoidSaleDto }) =>
            salesService.voidSale(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast({ title: 'تم إلغاء الفاتورة بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في إلغاء الفاتورة',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};

export const useAddSalePayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: AddPaymentDto }) =>
            salesService.addPayment(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['sales', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            toast({ title: 'تم تسجيل الدفعة بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في تسجيل الدفعة',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};
