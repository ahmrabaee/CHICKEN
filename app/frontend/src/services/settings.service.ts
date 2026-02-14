import axiosInstance from '@/lib/axios';

/**
 * System Settings API Service
 * Blueprint 02: GL Engine settings
 */
export const settingsService = {
    async getAll(): Promise<Record<string, unknown>> {
        const response = await axiosInstance.get<Record<string, unknown>>('/settings');
        return response.data;
    },

    async getByKey(key: string): Promise<{ key: string; value: unknown; dataType?: string; description?: string }> {
        const response = await axiosInstance.get(`/settings/${key}`);
        return response.data;
    },

    async set(key: string, value: unknown, description?: string): Promise<unknown> {
        const response = await axiosInstance.put(`/settings/${key}`, { value, description });
        return response.data;
    },

    async bulkUpdate(settings: { key: string; value: unknown }[]): Promise<{ updated: number }> {
        const response = await axiosInstance.post('/settings/bulk', settings);
        return response.data;
    },
};
