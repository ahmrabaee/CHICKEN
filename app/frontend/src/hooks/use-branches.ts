
import { useQuery } from '@tanstack/react-query';
import { branchService } from '@/services/branch.service';

export const useBranches = () => {
    return useQuery({
        queryKey: ['branches'],
        queryFn: () => branchService.getBranches(),
    });
};
