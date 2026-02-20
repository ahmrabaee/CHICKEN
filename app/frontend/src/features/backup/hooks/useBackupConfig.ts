import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '../api/backupApi';

export function useBackupConfig() {
    return useQuery({
        queryKey: ['backup', 'config'],
        queryFn: () => backupApi.getConfig(),
        staleTime: 30_000,
    });
}

export function useUpdateBackupConfig() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: backupApi.updateConfig,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['backup', 'config'] });
        },
    });
}
