
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService } from '@/services/customer.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerListQuery } from '@/types/customer';

/**
 * Hook to fetch customers with filters and pagination
 */
export const useCustomers = (query?: CustomerListQuery) => {
    return useQuery({
        queryKey: ['customers', query],
        queryFn: () => customerService.getCustomers(query),
    });
};

/**
 * Hook to fetch a single customer by ID
 */
export const useCustomer = (id: number) => {
    return useQuery({
        queryKey: ['customers', id],
        queryFn: () => customerService.getCustomer(id),
        enabled: !!id,
    });
};

/**
 * Hook to search customers
 */
export const useSearchCustomers = (q: string) => {
    return useQuery({
        queryKey: ['customers', 'search', q],
        queryFn: () => customerService.searchCustomers(q),
        enabled: q.length > 0,
    });
};

/**
 * Hook to create a new customer
 */
export const useCreateCustomer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateCustomerDto) => customerService.createCustomer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
};

/**
 * Hook to update a customer
 */
export const useUpdateCustomer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateCustomerDto }) =>
            customerService.updateCustomer(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['customers', variables.id] });
        },
    });
};

/**
 * Hook to delete a customer
 */
export const useDeleteCustomer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => customerService.deleteCustomer(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
};
