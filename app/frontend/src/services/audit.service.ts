
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { AuditLog, AuditQuery, ActionCount } from '@/types/audit';

export const auditService = {
    async getLogs(params?: AuditQuery): Promise<ApiResponse<AuditLog[]>> {
        const response = await axiosInstance.get<ApiResponse<AuditLog[]>>('/audit', { params });
        return response.data;
    },
    async getActionCounts(): Promise<ActionCount[]> {
        const response = await axiosInstance.get<ApiResponse<ActionCount[]>>('/audit/action-counts');
        return response.data.data;
    },
};
