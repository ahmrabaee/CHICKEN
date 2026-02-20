import { useQuery } from '@tanstack/react-query';
import { backupApi } from '../api/backupApi';
import { BackupListQuery } from '../types';

export function useBackupRuns(query: BackupListQuery) {
    return useQuery({
        queryKey: ['backup', 'runs', query],
        queryFn: () => backupApi.listRuns(query),
        staleTime: 10_000,
        refetchInterval: 10_000,
        refetchOnWindowFocus: true,
    });
}
