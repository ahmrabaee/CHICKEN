import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Payment,
    PaymentQuery,
    RecordSalePaymentDto,
    RecordPurchasePaymentDto,
    CancelPaymentDto,
    CreateAdvancePaymentDto,
} from '@/types/payments';

export const paymentService = {
    async getPayments(params?: PaymentQuery): Promise<ApiResponse<Payment[]>> {
        const response = await axiosInstance.get<ApiResponse<Payment[]>>('/payments', { params });
        return response.data;
    },

    async getPayment(id: number): Promise<Payment> {
        const response = await axiosInstance.get<ApiResponse<Payment>>(`/payments/${id}`);
        return response.data.data;
    },

    async recordSalePayment(data: RecordSalePaymentDto): Promise<Payment> {
        const response = await axiosInstance.post<ApiResponse<Payment>>('/payments/sale', data);
        return response.data.data;
    },

    async recordPurchasePayment(data: RecordPurchasePaymentDto): Promise<Payment> {
        const response = await axiosInstance.post<ApiResponse<Payment>>('/payments/purchase', data);
        return response.data.data;
    },

    async cancelPayment(id: number, data: CancelPaymentDto): Promise<{ success: boolean }> {
        const response = await axiosInstance.post<ApiResponse<{ success: boolean }>>(
            `/payments/${id}/cancel`,
            data
        );
        return response.data?.data ?? response.data ?? { success: true };
    },

    /** Blueprint 04: Create advance payment (no invoice) */
    async createAdvancePayment(data: CreateAdvancePaymentDto): Promise<Payment> {
        const response = await axiosInstance.post<ApiResponse<Payment>>('/payments/advance', data);
        return response.data.data;
    },
};
