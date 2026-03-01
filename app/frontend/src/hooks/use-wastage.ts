
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wastageService } from '@/services/wastage.service';
import { WastageQuery, CreateWastageDto } from '@/types/wastage';
import { toast } from '@/hooks/use-toast';

export const useWastageRecords = (params?: WastageQuery) => {
    return useQuery({
        queryKey: ['wastage', params],
        queryFn: () => wastageService.getWastageRecords(params),
    });
};

export const useWastageRecord = (id: number) => {
    return useQuery({
        queryKey: ['wastage', id],
        queryFn: () => wastageService.getWastageRecord(id),
        enabled: !!id,
    });
};

export const useCreateWastage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateWastageDto) => wastageService.createWastage(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wastage'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast({ title: 'تم تسجيل الهدر بنجاح' });
        },
        onError: (error: any) => {
            const errData = error.response?.data;
            const errObj = errData?.error ?? errData;
            const details = errObj?.details;
            const rawMsg = errObj?.messageAr || errObj?.message || (Array.isArray(details) ? details.join(', ') : undefined) || error.message || 'حدث خطأ';
            // Map common backend validation messages to user-friendly Arabic
            let desc = rawMsg;
            if (typeof rawMsg === 'string' && rawMsg.toLowerCase().includes('branchid')) {
                desc = 'اختر الفرع أولاً';
            }
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الهدر', description: desc });
        },
    });
};
