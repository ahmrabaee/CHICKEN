
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
    Customer,
    CreateCustomerDto,
    UpdateCustomerDto,
    CustomerListQuery,
    CustomerPaginatedResponse,
} from '@/types/customer';

/**
 * Customer API Service
 * Handles all customer-related API calls
 */
export const customerService = {
    /**
     * List all customers with filters and pagination
     * GET /v1/customers
     */
    async getCustomers(query?: CustomerListQuery): Promise<CustomerPaginatedResponse> {
        const params: Record<string, any> = {};
        if (query?.search) params.search = query.search;
        if (query?.phone) params.phone = query.phone;
        if (query?.priceLevel) params.priceLevel = query.priceLevel;
        if (query?.isActive !== undefined) params.isActive = query.isActive;
        if (query?.hasBalance !== undefined) params.hasBalance = query.hasBalance;
        if (query?.page) params.page = query.page;
        if (query?.pageSize) params.pageSize = query.pageSize;

        // API returns { success, data: Customer[], meta, pagination }
        // data is the customer array directly, pagination is at top level
        const response = await axiosInstance.get<ApiResponse<Customer[]>>('/customers', { params });
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
     * Search customers by name, phone, or customer number
     * GET /v1/customers/search?q=
     */
    async searchCustomers(q: string): Promise<Customer[]> {
        const response = await axiosInstance.get<ApiResponse<Customer[]>>('/customers/search', {
            params: { q },
        });
        return response.data.data;
    },

    /**
     * Get customer by ID
     * GET /v1/customers/:id
     */
    async getCustomer(id: number): Promise<Customer> {
        const response = await axiosInstance.get<ApiResponse<Customer>>(`/customers/${id}`);
        return response.data.data;
    },

    /**
     * Get customer by customer number
     * GET /v1/customers/number/:customerNumber
     */
    async getCustomerByNumber(customerNumber: string): Promise<Customer> {
        const response = await axiosInstance.get<ApiResponse<Customer>>(`/customers/number/${customerNumber}`);
        return response.data.data;
    },

    /**
     * Get customer by phone number
     * GET /v1/customers/phone/:phone
     */
    async getCustomerByPhone(phone: string): Promise<Customer> {
        const response = await axiosInstance.get<ApiResponse<Customer>>(`/customers/phone/${phone}`);
        return response.data.data;
    },

    /**
     * Create new customer
     * POST /v1/customers
     */
    async createCustomer(data: CreateCustomerDto): Promise<Customer> {
        const response = await axiosInstance.post<ApiResponse<Customer>>('/customers', data);
        return response.data.data;
    },

    /**
     * Update customer
     * PUT /v1/customers/:id
     */
    async updateCustomer(id: number, data: UpdateCustomerDto): Promise<Customer> {
        const response = await axiosInstance.put<ApiResponse<Customer>>(`/customers/${id}`, data);
        return response.data.data;
    },

    /**
     * Delete or deactivate customer
     * DELETE /v1/customers/:id
     */
    async deleteCustomer(id: number): Promise<void> {
        await axiosInstance.delete(`/customers/${id}`);
    },
};
