import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Supplier,
    CreateSupplierDto,
    UpdateSupplierDto,
    SupplierListQuery,
    SupplierPaginatedResponse,
} from '@/types/supplier';

/**
 * Supplier API Service
 * Handles all supplier-related API calls
 */
export const supplierService = {
    /**
     * List all suppliers with pagination
     * GET /v1/suppliers
     */
    async getSuppliers(query?: SupplierListQuery): Promise<SupplierPaginatedResponse> {
        const params: Record<string, any> = {};
        if (query?.search) params.search = query.search;
        if (query?.page) params.page = query.page;
        if (query?.pageSize) params.pageSize = query.pageSize;

        // API returns { success, data: Supplier[], meta, pagination }
        const response = await axiosInstance.get<ApiResponse<Supplier[]>>('/suppliers', { params });
        return {
            data: response.data.data,
            meta: response.data.pagination || {
                page: 1,
                pageSize: 20,
                totalItems: response.data.data.length,
                totalPages: 1,
            },
        };
    },

    /**
     * Get supplier by ID
     * GET /v1/suppliers/:id
     */
    async getSupplier(id: number): Promise<Supplier> {
        const response = await axiosInstance.get<ApiResponse<Supplier>>(`/suppliers/${id}`);
        return response.data.data;
    },

    /**
     * Create new supplier
     * POST /v1/suppliers
     */
    async createSupplier(data: CreateSupplierDto): Promise<Supplier> {
        const response = await axiosInstance.post<ApiResponse<Supplier>>('/suppliers', data);
        return response.data.data;
    },

    /**
     * Update supplier
     * PUT /v1/suppliers/:id
     */
    async updateSupplier(id: number, data: UpdateSupplierDto): Promise<Supplier> {
        const response = await axiosInstance.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data);
        return response.data.data;
    },

    /**
     * Delete or deactivate supplier
     * DELETE /v1/suppliers/:id
     */
    async deleteSupplier(id: number): Promise<void> {
        await axiosInstance.delete(`/suppliers/${id}`);
    },
};
