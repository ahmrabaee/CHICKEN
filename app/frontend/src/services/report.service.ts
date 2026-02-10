
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    DashboardSummary, SalesReport, PurchasesReport, InventoryReport,
    WastageReport, ExpenseReport, ProfitLossReport, DateRangeQuery,
} from '@/types/reports';

export const reportService = {
    async getDashboard(): Promise<DashboardSummary> {
        const response = await axiosInstance.get<ApiResponse<DashboardSummary>>('/reports/dashboard');
        return response.data.data;
    },
    async getSalesReport(params: DateRangeQuery): Promise<SalesReport> {
        const response = await axiosInstance.get<ApiResponse<SalesReport>>('/reports/sales', { params });
        return response.data.data;
    },
    async getPurchasesReport(params: DateRangeQuery): Promise<PurchasesReport> {
        const response = await axiosInstance.get<ApiResponse<PurchasesReport>>('/reports/purchases', { params });
        return response.data.data;
    },
    async getInventoryReport(): Promise<InventoryReport> {
        const response = await axiosInstance.get<ApiResponse<InventoryReport>>('/reports/inventory');
        return response.data.data;
    },
    async getWastageReport(params: DateRangeQuery): Promise<WastageReport> {
        const response = await axiosInstance.get<ApiResponse<WastageReport>>('/reports/wastage', { params });
        return response.data.data;
    },
    async getExpenseReport(params: DateRangeQuery): Promise<ExpenseReport> {
        const response = await axiosInstance.get<ApiResponse<ExpenseReport>>('/reports/expenses', { params });
        return response.data.data;
    },
    async getProfitLossReport(params: DateRangeQuery): Promise<ProfitLossReport> {
        const response = await axiosInstance.get<ApiResponse<ProfitLossReport>>('/reports/profit-loss', { params });
        return response.data.data;
    },
};
