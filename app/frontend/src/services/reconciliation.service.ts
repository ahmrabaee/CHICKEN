import axiosInstance from '@/lib/axios';

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface OpenInvoice {
  voucherType: 'sale' | 'purchase';
  voucherId: number;
  voucherNumber: string;
  partyName: string;
  postingDate: string;
  dueDate: string | null;
  totalAmount: number;
  outstandingAmount: number;
}

export interface UnallocatedPayment {
  id: number;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  partyName: string;
}

export interface SuggestMatch {
  paymentId: number;
  paymentNumber: string;
  invoiceType: 'sale' | 'purchase';
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  score: number;
}

export interface AllocationItem {
  paymentId: number;
  invoiceType: 'sale' | 'purchase';
  invoiceId: number;
  amount: number;
}

export const reconciliationService = {
  getSaleOutstanding: (saleId: number) =>
    axiosInstance.get<ApiResponse<number>>(`/reconciliation/outstanding/sale/${saleId}`),

  getPurchaseOutstanding: (purchaseId: number) =>
    axiosInstance.get<ApiResponse<number>>(`/reconciliation/outstanding/purchase/${purchaseId}`),

  getOpenInvoices: (partyType: 'customer' | 'supplier', partyId: number) =>
    axiosInstance.get<ApiResponse<OpenInvoice[]>>('/reconciliation/open-invoices', {
      params: { partyType, partyId },
    }),

  getUnallocatedPayments: (partyType: 'customer' | 'supplier', partyId: number) =>
    axiosInstance.get<ApiResponse<UnallocatedPayment[]>>('/reconciliation/unallocated-payments', {
      params: { partyType, partyId },
    }),

  getSuggest: (partyType: 'customer' | 'supplier', partyId: number) =>
    axiosInstance.get<ApiResponse<SuggestMatch[]>>('/reconciliation/suggest', {
      params: { partyType, partyId },
    }),

  apply: (body: {
    partyType: 'customer' | 'supplier';
    partyId: number;
    allocations: AllocationItem[];
  }) =>
    axiosInstance.post<ApiResponse<{ success: boolean; allocated: number }>>(
      '/reconciliation/apply',
      body,
    ),
};
