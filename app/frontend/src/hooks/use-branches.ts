
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { branchService } from '@/services/branch.service';
import { CreateBranchDto, UpdateBranchDto } from '@/types/branch';

/**
 * Hook to fetch all branches
 */
export const useBranches = () => {
    return useQuery({
        queryKey: ['branches'],
        queryFn: () => branchService.getBranches(),
    });
};

/**
 * Hook to fetch a single branch by ID
 */
export const useBranch = (id: number) => {
    return useQuery({
        queryKey: ['branches', id],
        queryFn: () => branchService.getBranch(id),
        enabled: !!id,
    });
};

/**
 * Hook to create a new branch
 */
export const useCreateBranch = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateBranchDto) => branchService.createBranch(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });
};

/**
 * Hook to update a branch
 */
export const useUpdateBranch = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateBranchDto }) =>
            branchService.updateBranch(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            queryClient.invalidateQueries({ queryKey: ['branches', variables.id] });
        },
    });
};

/**
 * Hook to deactivate a branch
 */
export const useDeleteBranch = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => branchService.deleteBranch(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });
};

/**
 * Hook to reactivate a branch
 */
export const useActivateBranch = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => branchService.activateBranch(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });
};
