import { useQuery } from '@tanstack/react-query';
import { backupApi } from '../api/backupApi';

export function useBackupStatus() {
    return useQuery({
        queryKey: ['backup', 'status'],
        queryFn: () => backupApi.getStatus(),
        refetchInterval: (query) => {
            // Poll every 5 seconds if a backup is currently running
            return query.state.data?.running ? 5000 : 30000;
        },
    });
}
