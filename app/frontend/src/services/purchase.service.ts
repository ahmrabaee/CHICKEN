
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Purchase,
    PurchaseQuery,
    CreatePurchaseDto,
    ReceivePurchaseDto,
} from '@/types/purchases';

/**
 * Purchases API Service
 * Endpoints: GET /purchases, GET /purchases/:id, POST /purchases, PUT /purchases/:id/receive
 */
export const purchaseService = {
    async getPurchases(params?: PurchaseQuery): Promise<ApiResponse<Purchase[]>> {
        const response = await axiosInstance.get<ApiResponse<Purchase[]>>('/purchases', { params });
        return response.data;
    },

    async getPurchase(id: number): Promise<Purchase> {
        const response = await axiosInstance.get<ApiResponse<Purchase>>(`/purchases/${id}`);
        return response.data.data;
    },

    async createPurchase(data: CreatePurchaseDto): Promise<Purchase> {
        const response = await axiosInstance.post<ApiResponse<Purchase>>('/purchases', data);
        return response.data.data;
    },

    async receivePurchase(id: number, data: ReceivePurchaseDto): Promise<Purchase> {
        const response = await axiosInstance.put<ApiResponse<Purchase>>(`/purchases/${id}/receive`, data);
        return response.data.data;
    },
};
