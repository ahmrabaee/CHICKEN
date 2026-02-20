import axiosInstance from '@/lib/axios';
import type {
    BackupConfig,
    BackupSystemStatus,
    BackupListResult,
    BackupListQuery,
    DownloadLink,
} from '../types';

const BASE = '/system';

type ApiResponseEnvelope<T> = {
    success: boolean;
    data: T;
    meta?: {
        timestamp: string;
        requestId?: string;
    };
};

function unwrapApiData<T>(payload: T | ApiResponseEnvelope<T>): T {
    if (
        payload &&
        typeof payload === 'object' &&
        'success' in payload &&
        'data' in payload
    ) {
        return (payload as ApiResponseEnvelope<T>).data;
    }
    return payload as T;
}

export const backupApi = {
    async getConfig(): Promise<BackupConfig> {
        const res = await axiosInstance.get<BackupConfig | ApiResponseEnvelope<BackupConfig>>(`${BASE}/backup/config`);
        return unwrapApiData(res.data);
    },

    async updateConfig(payload: Partial<Pick<BackupConfig, 'auto_enabled' | 'path_vps'>>): Promise<BackupConfig> {
        const res = await axiosInstance.put<BackupConfig | ApiResponseEnvelope<BackupConfig>>(`${BASE}/backup/config`, payload);
        return unwrapApiData(res.data);
    },

    async getStatus(): Promise<BackupSystemStatus> {
        const res = await axiosInstance.get<BackupSystemStatus | ApiResponseEnvelope<BackupSystemStatus>>(`${BASE}/backup/status`);
        return unwrapApiData(res.data);
    },

    async listRuns(query?: BackupListQuery): Promise<BackupListResult> {
        const res = await axiosInstance.get<BackupListResult | ApiResponseEnvelope<BackupListResult>>(`${BASE}/backups`, {
            params: query,
        });
        return unwrapApiData(res.data);
    },

    async createManualBackup(): Promise<{ message: string }> {
        const res = await axiosInstance.post<{ message: string } | ApiResponseEnvelope<{ message: string }>>(`${BASE}/backup`);
        return unwrapApiData(res.data);
    },

    async createDownloadLink(id: number): Promise<DownloadLink> {
        const res = await axiosInstance.post<DownloadLink | ApiResponseEnvelope<DownloadLink>>(`${BASE}/backups/${id}/download-link`);
        return unwrapApiData(res.data);
    },

    async restoreBackup(id: number): Promise<{ message: string; messageAr?: string }> {
        const res = await axiosInstance.post<{ message: string; messageAr?: string } | ApiResponseEnvelope<{ message: string; messageAr?: string }>>(`${BASE}/backups/${id}/restore`);
        return unwrapApiData(res.data);
    },

    async importBackup(
        file: File,
        options?: { restoreAfterImport?: boolean },
    ): Promise<{
        message: string;
        messageAr?: string;
        backupId?: number;
        restored?: boolean;
        restoreMessage?: string;
        restoreMessageAr?: string;
    }> {
        const formData = new FormData();
        formData.append('file', file);
        if (options?.restoreAfterImport) {
            formData.append('restoreAfterImport', 'true');
        }
        const res = await axiosInstance.post<
            {
                message: string;
                messageAr?: string;
                backupId?: number;
                restored?: boolean;
                restoreMessage?: string;
                restoreMessageAr?: string;
            } | ApiResponseEnvelope<{
                message: string;
                messageAr?: string;
                backupId?: number;
                restored?: boolean;
                restoreMessage?: string;
                restoreMessageAr?: string;
            }>
        >(`${BASE}/backups/import`, formData);
        return unwrapApiData(res.data);
    },
};
