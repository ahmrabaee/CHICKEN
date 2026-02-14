import axiosInstance from '@/lib/axios';

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface CreditNote {
  id: number;
  creditNoteNumber: string;
  creditNoteDate: string;
  docstatus: number;
  originalInvoiceType: string;
  originalInvoiceId: number;
  amount: number;
  reason: string | null;
  branchId: number | null;
  createdById: number | null;
  submittedAt: string | null;
  submittedById: number | null;
  branch?: { id: number; name: string };
  createdBy?: { username: string };
}

export interface CreateCreditNoteDto {
  originalInvoiceType: 'sale' | 'purchase';
  originalInvoiceId: number;
  amount: number;
  reason?: string;
  branchId?: number;
}

export const creditNoteService = {
  getAll: (params?: { page?: number; pageSize?: number; originalInvoiceType?: string; originalInvoiceId?: number }) =>
    axiosInstance.get<ApiResponse<{ items: CreditNote[]; total: number; page: number; pageSize: number }>>(
      '/credit-notes',
      { params },
    ),

  getById: (id: number) =>
    axiosInstance.get<ApiResponse<CreditNote>>(`/credit-notes/${id}`),

  create: (data: CreateCreditNoteDto) =>
    axiosInstance.post<ApiResponse<CreditNote>>('/credit-notes', data),

  submit: (id: number) =>
    axiosInstance.post<ApiResponse<CreditNote>>(`/credit-notes/${id}/submit`),
};
