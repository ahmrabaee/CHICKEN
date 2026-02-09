
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    InventoryItem,
    InventoryQuery,
    AdjustStockDto,
    TransferStockDto,
    CheckAvailabilityRequest,
    AvailabilityResult
} from '@/types/inventory';

/**
 * Inventory API Service
 * Handles aggregated stock, lots, adjustments and transfers
 */
export const inventoryService = {
    /**
     * List inventory with filters
     * GET /v1/inventory
     */
    async getInventory(params?: InventoryQuery): Promise<ApiResponse<InventoryItem[]>> {
        const response = await axiosInstance.get<ApiResponse<InventoryItem[]>>('/inventory', { params });
        return response.data;
    },

    /**
     * Get stock for specific item
     * GET /v1/inventory/:itemId
     */
    async getItemInventory(itemId: number): Promise<InventoryItem> {
        const response = await axiosInstance.get<ApiResponse<InventoryItem>>(`/inventory/${itemId}`);
        return response.data.data;
    },

    /**
     * Get FIFO lots for an item
     * GET /v1/inventory/:itemId/lots
     */
    async getLots(itemId: number): Promise<any[]> {
        const response = await axiosInstance.get<ApiResponse<any[]>>(`/inventory/${itemId}/lots`);
        return response.data.data;
    },

    /**
     * Get stock movement history for an item
     * GET /v1/inventory/:itemId/movements
     */
    async getMovements(itemId: number, params?: any): Promise<ApiResponse<any[]>> {
        const response = await axiosInstance.get<ApiResponse<any[]>>(`/inventory/${itemId}/movements`, { params });
        return response.data;
    },

    /**
     * Create manual stock adjustment
     * POST /v1/inventory/adjustments
     */
    async adjustStock(data: AdjustStockDto): Promise<any> {
        const response = await axiosInstance.post<ApiResponse<any>>('/inventory/adjustments', data);
        return response.data.data;
    },

    /**
     * Get items expiring soon
     * GET /v1/inventory/expiring
     */
    async getExpiring(days?: number): Promise<any[]> {
        const params = days ? { days } : {};
        const response = await axiosInstance.get<ApiResponse<any[]>>('/inventory/expiring', { params });
        return response.data.data;
    },

    /**
     * Get items below minimum stock level
     * GET /v1/inventory/low-stock
     */
    async getLowStock(): Promise<any[]> {
        const response = await axiosInstance.get<ApiResponse<any[]>>('/inventory/low-stock');
        return response.data.data;
    },
};
