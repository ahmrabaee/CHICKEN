
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { Debt, DebtQuery, DebtSummary } from '@/types/debts';

export const debtService = {
    async getReceivables(params?: DebtQuery): Promise<ApiResponse<Debt[]>> {
        const response = await axiosInstance.get<ApiResponse<Debt[]>>('/debts/receivables', { params });
        return response.data;
    },

    async getPayables(params?: DebtQuery): Promise<ApiResponse<Debt[]>> {
        const response = await axiosInstance.get<ApiResponse<Debt[]>>('/debts/payables', { params });
        return response.data;
    },

    async getSummary(): Promise<DebtSummary> {
        const response = await axiosInstance.get<ApiResponse<DebtSummary>>('/debts/summary');
        return response.data.data;
    },

    async getOverdue(): Promise<ApiResponse<Debt[]>> {
        const response = await axiosInstance.get<ApiResponse<Debt[]>>('/debts/overdue');
        return response.data;
    },

    async getDebt(id: number): Promise<Debt> {
        const response = await axiosInstance.get<ApiResponse<Debt>>(`/debts/${id}`);
        return response.data.data;
    },
};
