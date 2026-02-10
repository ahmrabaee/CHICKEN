import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService } from '@/services/supplier.service';
import {
    CreateSupplierDto,
    UpdateSupplierDto,
    SupplierListQuery,
} from '@/types/supplier';

/**
 * Hook to fetch paginated supplier list with filters
 */
export const useSuppliers = (query?: SupplierListQuery) => {
    return useQuery({
        queryKey: ['suppliers', query],
        queryFn: () => supplierService.getSuppliers(query),
    });
};

/**
 * Hook to fetch a single supplier by ID
 */
export const useSupplier = (id: number) => {
    return useQuery({
        queryKey: ['suppliers', id],
        queryFn: () => supplierService.getSupplier(id),
        enabled: id > 0,
    });
};

/**
 * Hook to create a new supplier
 */
export const useCreateSupplier = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateSupplierDto) => supplierService.createSupplier(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });
};

/**
 * Hook to update an existing supplier
 */
export const useUpdateSupplier = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateSupplierDto }) =>
            supplierService.updateSupplier(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });
};

/**
 * Hook to delete a supplier
 */
export const useDeleteSupplier = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => supplierService.deleteSupplier(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });
};
