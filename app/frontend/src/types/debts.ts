
/**
 * Debts Module Types
 * Matches backend DTOs from debts controller and Prisma Debt model
 */

export interface Debt {
    id: number;
    debtType: 'receivable' | 'payable';
    customerId?: number;
    customerName?: string;
    supplierId?: number;
    supplierName?: string;
    saleId?: number;
    saleNumber?: string;
    purchaseId?: number;
    purchaseNumber?: string;
    originalAmount: number;
    remainingAmount: number;
    status: 'outstanding' | 'partial' | 'settled' | 'written_off';
    dueDate?: string;
    isOverdue?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface DebtQuery {
    customerId?: number;
    supplierId?: number;
    status?: string;
    page?: number;
    pageSize?: number;
}

export interface DebtSummary {
    totalReceivables: number;
    totalPayables: number;
    netPosition: number;
    overdueReceivables: number;
    overduePayables: number;
}
