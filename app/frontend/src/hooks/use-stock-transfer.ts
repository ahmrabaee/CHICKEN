import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockTransferService, CreateStockTransferDto } from '@/services/stock-transfer.service';
import { toast } from '@/hooks/use-toast';

export const useSourceLots = (branchId?: number, itemId?: number) => {
  return useQuery({
    queryKey: ['stock-transfer', 'source-lots', branchId, itemId],
    queryFn: () => stockTransferService.getSourceLots(branchId, itemId),
  });
};

export const useTransferrableProducts = (excludeItemId?: number) => {
  return useQuery({
    queryKey: ['stock-transfer', 'products', excludeItemId],
    queryFn: () => stockTransferService.getProducts(excludeItemId),
  });
};

export const useStockTransfers = (page = 1, pageSize = 20) => {
  return useQuery({
    queryKey: ['stock-transfer', 'list', page, pageSize],
    queryFn: () => stockTransferService.getTransfers(page, pageSize),
  });
};

export const useStockTransfer = (id: number) => {
  return useQuery({
    queryKey: ['stock-transfer', id],
    queryFn: () => stockTransferService.getTransfer(id),
    enabled: !!id,
  });
};

export const useCreateStockTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStockTransferDto) => stockTransferService.createTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfer'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'تم تحويل المخزون بنجاح' });
    },
    onError: (error: any) => {
      const err = error.response?.data?.error;
      const details = err?.details;
      const desc = err?.messageAr || err?.message || (Array.isArray(details) ? details[0] : undefined) || error.message || 'حدث خطأ';
      toast({ variant: 'destructive', title: 'خطأ في تحويل المخزون', description: desc });
    },
  });
};
