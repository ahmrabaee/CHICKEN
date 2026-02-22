
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryService } from '@/services/category.service';
import { itemService } from '@/services/item.service';
import { inventoryService } from '@/services/inventory.service';
import {
    InventoryQuery,
    ItemQuery,
    AdjustStockDto,
    TransferStockDto,
    Category,
    Item
} from '@/types/inventory';
import { toast } from '@/hooks/use-toast';

/**
 * Categories Hooks
 */
export const usePurchaseableCategories = () => {
    return useQuery({
        queryKey: ['categories', 'purchaseable'],
        queryFn: () => categoryService.getPurchaseableCategories(),
    });
};

export const useCategories = (includeInactive = false) => {
    return useQuery({
        queryKey: ['categories', includeInactive],
        queryFn: () => categoryService.getCategories(includeInactive),
    });
};

export const useCreateCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<Category>) => categoryService.createCategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast({ title: 'تم إضافة التصنيف بنجاح' });
        },
    });
};

export const useUpdateCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Category> }) =>
            categoryService.updateCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            toast({ title: 'تم تحديث التصنيف بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في تحديث التصنيف',
                description: error.response?.data?.messageAr || 'حدث خطأ غير متوقع',
            });
        },
    });
};

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => categoryService.deleteCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            toast({ title: 'تم حذف التصنيف بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في حذف التصنيف',
                description: error.response?.data?.messageAr || 'حدث خطأ غير متوقع',
            });
        },
    });
};

/**
 * Items Hooks
 */
export const useItems = (params?: ItemQuery) => {
    return useQuery({
        queryKey: ['items', params],
        queryFn: () => itemService.getItems(params),
    });
};

export const useItem = (id: number) => {
    return useQuery({
        queryKey: ['items', id],
        queryFn: () => itemService.getItem(id),
        enabled: !!id,
    });
};

export const useCreateItem = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<Item>) => itemService.createItem(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast({ title: 'تم إضافة المنتج بنجاح' });
        },
    });
};

/**
 * Inventory Hooks
 */
export const useInventory = (params?: InventoryQuery) => {
    return useQuery({
        queryKey: ['inventory', params],
        queryFn: () => inventoryService.getInventory(params),
    });
};

export const useItemInventory = (itemId: number) => {
    return useQuery({
        queryKey: ['inventory', 'item', itemId],
        queryFn: () => inventoryService.getItemInventory(itemId),
        enabled: !!itemId,
    });
};

export const useInventoryLots = (itemId: number) => {
    return useQuery({
        queryKey: ['inventory', 'lots', itemId],
        queryFn: () => inventoryService.getLots(itemId),
        enabled: !!itemId,
    });
};

export const useInventoryMovements = (itemId: number, params?: any) => {
    return useQuery({
        queryKey: ['inventory', 'movements', itemId, params],
        queryFn: () => inventoryService.getMovements(itemId, params),
        enabled: !!itemId,
    });
};

export const useExpiringItems = (days?: number) => {
    return useQuery({
        queryKey: ['inventory', 'expiring', days],
        queryFn: () => inventoryService.getExpiring(days),
    });
};

export const useLowStockItems = () => {
    return useQuery({
        queryKey: ['inventory', 'low-stock'],
        queryFn: () => inventoryService.getLowStock(),
    });
};

export const useAdjustStock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: AdjustStockDto) => inventoryService.adjustStock(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            toast({ title: 'تم تعديل المخزون بنجاح' });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في تعديل المخزون',
                description: error.response?.data?.messageAr || 'حدث خطأ غير متوقع',
            });
        },
    });
};
