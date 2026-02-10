
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseService } from '@/services/purchase.service';
import { PurchaseQuery, CreatePurchaseDto, ReceivePurchaseDto } from '@/types/purchases';
import { toast } from '@/hooks/use-toast';

export const usePurchases = (params?: PurchaseQuery) => {
    return useQuery({
        queryKey: ['purchases', params],
        queryFn: () => purchaseService.getPurchases(params),
    });
};

export const usePurchase = (id: number) => {
    return useQuery({
        queryKey: ['purchases', id],
        queryFn: () => purchaseService.getPurchase(id),
        enabled: !!id,
    });
};

export const useCreatePurchase = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreatePurchaseDto) => purchaseService.createPurchase(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            toast({ title: 'تم إنشاء أمر الشراء بنجاح' });
        },
        onError: (error: any) => {
            const err = error.response?.data?.error;
            const description = err?.messageAr || err?.message || error.response?.data?.message || 'حدث خطأ غير متوقع';
            toast({
                variant: 'destructive',
                title: 'خطأ في إنشاء أمر الشراء',
                description,
            });
        },
    });
};

export const useReceivePurchase = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: ReceivePurchaseDto }) =>
            purchaseService.receivePurchase(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast({ title: 'تم استلام البضاعة بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في استلام البضاعة',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};
