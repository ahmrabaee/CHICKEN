
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Branch,
    CreateBranchDto,
    UpdateBranchDto,
    BranchListResponse
} from '@/types/branch';

/**
 * Branch API Service
 * Handles all branch-related API calls
 */
export const branchService = {
    /**
     * List all branches
     * GET /v1/branches
     */
    async getBranches(): Promise<Branch[]> {
        const response = await axiosInstance.get<ApiResponse<BranchListResponse>>('/branches');
        return response.data.data.branches;
    },

    /**
     * Get branch by ID
     * GET /v1/branches/:id
     */
    async getBranch(id: number): Promise<Branch> {
        const response = await axiosInstance.get<ApiResponse<Branch>>(`/branches/${id}`);
        return response.data.data;
    },

    /**
     * Create new branch
     * POST /v1/branches
     */
    async createBranch(data: CreateBranchDto): Promise<Branch> {
        const response = await axiosInstance.post<ApiResponse<Branch>>('/branches', data);
        return response.data.data;
    },

    /**
     * Update branch
     * PUT /v1/branches/:id
     */
    async updateBranch(id: number, data: UpdateBranchDto): Promise<Branch> {
        const response = await axiosInstance.put<ApiResponse<Branch>>(`/branches/${id}`, data);
        return response.data.data;
    },

    /**
     * Deactivate branch (soft delete)
     * DELETE /v1/branches/:id
     */
    async deleteBranch(id: number): Promise<void> {
        await axiosInstance.delete(`/branches/${id}`);
    },

    /**
     * Reactivate a deactivated branch
     * POST /v1/branches/:id/activate
     */
    async activateBranch(id: number): Promise<Branch> {
        const response = await axiosInstance.post<ApiResponse<Branch>>(`/branches/${id}/activate`);
        return response.data.data;
    },
};
