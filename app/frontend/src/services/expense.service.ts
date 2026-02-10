
import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { Expense, ExpenseQuery, CreateExpenseDto, UpdateExpenseDto, ExpenseSummary } from '@/types/expenses';

export const expenseService = {
    async getExpenses(params?: ExpenseQuery): Promise<ApiResponse<Expense[]>> {
        const response = await axiosInstance.get<ApiResponse<Expense[]>>('/expenses', { params });
        return response.data;
    },

    async getExpense(id: number): Promise<Expense> {
        const response = await axiosInstance.get<ApiResponse<Expense>>(`/expenses/${id}`);
        return response.data.data;
    },

    async createExpense(data: CreateExpenseDto): Promise<Expense> {
        const response = await axiosInstance.post<ApiResponse<Expense>>('/expenses', data);
        return response.data.data;
    },

    async updateExpense(id: number, data: UpdateExpenseDto): Promise<Expense> {
        const response = await axiosInstance.put<ApiResponse<Expense>>(`/expenses/${id}`, data);
        return response.data.data;
    },

    async deleteExpense(id: number): Promise<void> {
        await axiosInstance.delete(`/expenses/${id}`);
    },

    async approveExpense(id: number): Promise<Expense> {
        const response = await axiosInstance.post<ApiResponse<Expense>>(`/expenses/${id}/approve`);
        return response.data.data;
    },

    async getCategories(): Promise<any[]> {
        const response = await axiosInstance.get<ApiResponse<any[]>>('/expenses/categories');
        return response.data.data;
    },

    async getSummary(): Promise<ExpenseSummary> {
        const response = await axiosInstance.get<ApiResponse<ExpenseSummary>>('/expenses/summary');
        return response.data.data;
    },
};
