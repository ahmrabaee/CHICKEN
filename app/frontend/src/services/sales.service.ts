
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Sale,
    SaleQuery,
    CreateSaleDto,
    VoidSaleDto,
    AddPaymentDto,
    SaleReceipt,
} from '@/types/sales';

/**
 * Sales API Service
 * Endpoints: GET /sales, GET /sales/:id, GET /sales/:id/receipt,
 *            POST /sales, POST /sales/:id/void, POST /sales/:id/payments
 */
export const salesService = {
    /**
     * List sales (paginated, filterable)
     * GET /v1/sales
     */
    async getSales(params?: SaleQuery): Promise<ApiResponse<Sale[]>> {
        const response = await axiosInstance.get<ApiResponse<Sale[]>>('/sales', { params });
        return response.data;
    },

    /**
     * Get sale details with cost allocation
     * GET /v1/sales/:id
     */
    async getSale(id: number): Promise<Sale> {
        const response = await axiosInstance.get<ApiResponse<Sale>>(`/sales/${id}`);
        return response.data.data;
    },

    /**
     * Get receipt data for printing
     * GET /v1/sales/:id/receipt
     */
    async getReceipt(id: number): Promise<SaleReceipt> {
        const response = await axiosInstance.get<ApiResponse<SaleReceipt>>(`/sales/${id}/receipt`);
        return response.data.data;
    },

    /**
     * Create new sale (POS transaction)
     * POST /v1/sales
     */
    async createSale(data: CreateSaleDto): Promise<Sale> {
        const response = await axiosInstance.post<ApiResponse<Sale>>('/sales', data);
        return response.data.data;
    },

    /**
     * Void a sale (Admin only)
     * POST /v1/sales/:id/void
     */
    async voidSale(id: number, data: VoidSaleDto): Promise<Sale> {
        const response = await axiosInstance.post<ApiResponse<Sale>>(`/sales/${id}/void`, data);
        return response.data.data;
    },

    /**
     * Add payment to sale
     * POST /v1/sales/:id/payments
     */
    async addPayment(id: number, data: AddPaymentDto): Promise<any> {
        const response = await axiosInstance.post<ApiResponse<any>>(`/sales/${id}/payments`, data);
        return response.data.data;
    },
};
