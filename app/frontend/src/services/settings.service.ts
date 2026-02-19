import axiosInstance from '@/lib/axios';

/**
 * System Settings API Service
 * Blueprint 02: GL Engine settings
 */
export const settingsService = {
    async getAll(): Promise<Record<string, unknown>> {
        const response = await axiosInstance.get<{ success: boolean; data: Record<string, unknown> }>('/settings');
        return response.data?.data ?? response.data;
    },

    async getByKey(key: string): Promise<{ key: string; value: unknown; dataType?: string; description?: string }> {
        const response = await axiosInstance.get<{ success: boolean; data: unknown }>(`/settings/${key}`);
        return (response.data?.data ?? response.data) as any;
    },

    async set(key: string, value: unknown, description?: string): Promise<unknown> {
        const response = await axiosInstance.put<{ success: boolean; data: unknown }>(`/settings/${key}`, { value, description });
        return response.data?.data ?? response.data;
    },

    async bulkUpdate(settings: { key: string; value: unknown }[]): Promise<{ updated: number }> {
        const response = await axiosInstance.post<{ success: boolean; data: unknown }>('/settings/bulk', settings);
        return (response.data?.data ?? response.data) as any;
    },

    async updateCompany(data: any): Promise<any> {
        const response = await axiosInstance.put<{ success: boolean; data: unknown }>('/settings/company', data);
        return response.data?.data ?? response.data;
    },
};
