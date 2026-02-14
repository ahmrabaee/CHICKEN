import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxService } from '@/services/tax.service';
import { toast } from 'sonner';
import type { CreateTaxTemplateDto } from '@/types/tax';

export const useTaxTemplates = (type?: 'sales' | 'purchases') => {
    return useQuery({
        queryKey: ['tax', 'templates', type],
        queryFn: () => taxService.getTemplates(type),
    });
};

export const useTaxTemplate = (id: number | null) => {
    return useQuery({
        queryKey: ['tax', 'templates', id],
        queryFn: () => taxService.getTemplate(id!),
        enabled: !!id,
    });
};

export const useCreateTaxTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateTaxTemplateDto) => taxService.createTemplate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax', 'templates'] });
            toast.success('تم إنشاء قالب الضريبة بنجاح');
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ?? 'فشل إنشاء القالب';
            toast.error(msg);
        },
    });
};

export const useUpdateTaxTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CreateTaxTemplateDto> & { isActive?: boolean } }) =>
            taxService.updateTemplate(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax', 'templates'] });
            toast.success('تم تحديث القالب بنجاح');
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ?? 'فشل التحديث';
            toast.error(msg);
        },
    });
};

export const useDeleteTaxTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => taxService.deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax', 'templates'] });
            toast.success('تم حذف القالب');
        },
        onError: (e: unknown) => {
            const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code;
            const msgAr = (e as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr;
            if (code === 'TEMPLATE_IN_USE') {
                toast.error('لا يمكن حذف القالب لاستخدامه في فواتير');
            } else {
                toast.error(msgAr ?? 'فشل الحذف');
            }
        },
    });
};

export const useVATReport = (startDate: string, endDate: string, companyId?: number) => {
    return useQuery({
        queryKey: ['tax', 'vat-report', startDate, endDate, companyId],
        queryFn: () => taxService.getVATReport(startDate, endDate, companyId),
        enabled: !!startDate && !!endDate,
    });
};
