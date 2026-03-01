
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { Item, ItemQuery, CreateItemDto } from '@/types/inventory';

/**
 * Item API Service
 */
export const itemService = {
    /**
     * List all items with pagination and filters
     * GET /v1/items
     */
    async getItems(params?: ItemQuery): Promise<ApiResponse<Item[]>> {
        const response = await axiosInstance.get<ApiResponse<Item[]>>('/items', { params });
        return response.data;
    },

    /**
     * Get item by ID
     * GET /v1/items/{id}
     */
    async getItem(id: number): Promise<Item> {
        const response = await axiosInstance.get<ApiResponse<Item>>(`/items/${id}`);
        return response.data.data;
    },

    /**
     * Create new item
     * POST /v1/items
     */
    async createItem(data: CreateItemDto): Promise<Item> {
        const response = await axiosInstance.post<ApiResponse<Item>>('/items', data);
        return response.data.data;
    },

    /**
     * Update item
     * PUT /v1/items/{id}
     */
    async updateItem(id: number, data: Partial<CreateItemDto>): Promise<Item> {
        const response = await axiosInstance.put<ApiResponse<Item>>(`/items/${id}`, data);
        return response.data.data;
    },

    /**
     * Deactivate item (soft delete)
     * DELETE /v1/items/{id}
     */
    async deleteItem(id: number): Promise<any> {
        const response = await axiosInstance.delete(`/items/${id}`);
        return response.data?.data ?? response.data;
    },

    /**
     * Get item by barcode
     * GET /v1/items/barcode/{barcode}
     */
    async findByBarcode(barcode: string): Promise<Item> {
        const response = await axiosInstance.get<ApiResponse<Item>>(`/items/barcode/${encodeURIComponent(barcode)}`);
        return response.data.data;
    },
};
