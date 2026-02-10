
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { WastageRecord, WastageQuery, CreateWastageDto } from '@/types/wastage';

export const wastageService = {
    async getWastageRecords(params?: WastageQuery): Promise<ApiResponse<WastageRecord[]>> {
        const response = await axiosInstance.get<ApiResponse<WastageRecord[]>>('/wastage', { params });
        return response.data;
    },

    async getWastageRecord(id: number): Promise<WastageRecord> {
        const response = await axiosInstance.get<ApiResponse<WastageRecord>>(`/wastage/${id}`);
        return response.data.data;
    },

    async createWastage(data: CreateWastageDto): Promise<WastageRecord> {
        const response = await axiosInstance.post<ApiResponse<WastageRecord>>('/wastage', data);
        return response.data.data;
    },
};
