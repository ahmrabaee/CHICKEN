import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import type { TaxTemplate, VATReport, CreateTaxTemplateDto } from '@/types/tax';

const BASE = '/tax';

export const taxService = {
    async getTemplates(type?: 'sales' | 'purchases', companyId?: number): Promise<TaxTemplate[]> {
        const params: Record<string, string> = {};
        if (type) params.type = type;
        if (companyId != null) params.companyId = String(companyId);
        const response = await axiosInstance.get<ApiResponse<TaxTemplate[]>>(`${BASE}/templates`, { params });
        return response.data.data ?? [];
    },

    async getTemplate(id: number): Promise<TaxTemplate> {
        const response = await axiosInstance.get<ApiResponse<TaxTemplate>>(`${BASE}/templates/${id}`);
        return response.data.data;
    },

    async createTemplate(data: CreateTaxTemplateDto): Promise<TaxTemplate> {
        const response = await axiosInstance.post<ApiResponse<TaxTemplate>>(`${BASE}/templates`, data);
        return response.data.data;
    },

    async updateTemplate(id: number, data: Partial<CreateTaxTemplateDto> & { isActive?: boolean }): Promise<TaxTemplate> {
        const response = await axiosInstance.put<ApiResponse<TaxTemplate>>(`${BASE}/templates/${id}`, data);
        return response.data.data;
    },

    async deleteTemplate(id: number): Promise<void> {
        await axiosInstance.delete(`${BASE}/templates/${id}`);
    },

    async getVATReport(startDate: string, endDate: string, companyId?: number): Promise<VATReport> {
        const params: Record<string, string> = { startDate, endDate };
        if (companyId != null) params.companyId = String(companyId);
        const response = await axiosInstance.get<ApiResponse<VATReport>>(`${BASE}/vat-report`, { params });
        return response.data.data ?? { outputVat: 0, inputVat: 0, netVatPayable: 0, byAccount: [], byRate: [] };
    },
};
