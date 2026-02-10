
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
            const err = error.response?.data?.error;
            const details = err?.details;
            const desc = err?.messageAr || err?.message || (Array.isArray(details) ? details[0] : undefined) || error.message || 'حدث خطأ';
            toast({ variant: 'destructive', title: 'خطأ في تسجيل الهدر', description: desc });
        },
    });
};
