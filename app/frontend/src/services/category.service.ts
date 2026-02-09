
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { Category } from '@/types/inventory';

/**
 * Category API Service
 */
export const categoryService = {
    /**
     * List all categories
     * GET /v1/categories
     */
    async getCategories(): Promise<Category[]> {
        const response = await axiosInstance.get<ApiResponse<Category[]>>('/categories');
        return response.data.data;
    },

    /**
     * Create new category
     * POST /v1/categories
     */
    async createCategory(data: Partial<Category>): Promise<Category> {
        const response = await axiosInstance.post<ApiResponse<Category>>('/categories', data);
        return response.data.data;
    },

    /**
     * Update category
     * PUT /v1/categories/{id}
     */
    async updateCategory(id: number, data: Partial<Category>): Promise<Category> {
        const response = await axiosInstance.put<ApiResponse<Category>>(`/categories/${id}`, data);
        return response.data.data;
    },

    /**
     * Delete category
     * DELETE /v1/categories/{id}
     */
    async deleteCategory(id: number): Promise<void> {
        await axiosInstance.delete(`/categories/${id}`);
    },
};
