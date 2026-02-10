
import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/audit.service';
import { AuditQuery } from '@/types/audit';

export const useAuditLogs = (params?: AuditQuery) => {
    return useQuery({
        queryKey: ['audit', params],
        queryFn: () => auditService.getLogs(params),
    });
};

export const useAuditActionCounts = () => {
    return useQuery({
        queryKey: ['audit', 'action-counts'],
        queryFn: () => auditService.getActionCounts(),
    });
};
