
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';

export interface Branch {
    id: number;
    name: string;
    location?: string;
    phone?: string;
    isActive: boolean;
}

/**
 * Branch API Service
 */
export const branchService = {
    /**
     * List all active branches
     * GET /v1/branches
     */
    async getBranches(): Promise<Branch[]> {
        const response = await axiosInstance.get<ApiResponse<Branch[]>>('/branches');
        return response.data.data;
    },
};
