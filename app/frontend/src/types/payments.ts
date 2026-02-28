
/**
 * Payments Module Types
 * Matches backend DTOs in payments/dto/payment.dto.ts and Prisma Payment model
 */

export interface Payment {
    id: number;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    referenceType?: 'sale' | 'purchase' | 'expense' | 'debt' | null;
    referenceId?: number | null;
    partyType?: 'customer' | 'supplier';
    partyId?: number;
    partyName?: string;
    receiptNumber?: string;
    bankTransactionId?: string;
    bankAccountId?: number;
    receivedById?: number;
    branchId?: number;
    isVoided: boolean;
    notes?: string;
    createdAt: string;

    // Blueprint 03: docstatus and workflow fields
    docstatus?: 0 | 1 | 2;
    cancelledAt?: string;
    cancelledById?: number;
    cancelReason?: string;
    updatedAt: string;

    // Relations (included in some responses — full Prisma objects)
    receivedBy?: {
        id: number;
        username: string;
        fullName: string;
        fullNameEn?: string;
        phone?: string;
        email?: string;
        employeeNumber?: string;
    };
    branch?: {
        id: number;
        name: string;
        nameEn?: string;
    };

    // UI Helpers (if added by service/backend specifically for frontend)
    saleNumber?: string;
    purchaseNumber?: string;
}

export interface PaymentQuery {
    type?: 'sale' | 'purchase';
    page?: number;
    pageSize?: number;
}

export interface RecordSalePaymentDto {
    saleId: number;
    amount: number;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile_payment' | 'check';
    referenceNumber?: string;
    notes?: string;
    paymentDate?: string;
    bankAccountId?: number;
}

export interface CancelPaymentDto {
    reason: string;
}

export interface RecordPurchasePaymentDto {
    purchaseId: number;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    receiptNumber?: string;
    paymentDate?: string;
    notes?: string;
    bankAccountId?: number;
}

/** Blueprint 04: Advance payment (no invoice — for reconciliation later) */
export interface CreateAdvancePaymentDto {
    partyType: 'customer' | 'supplier';
    partyId: number;
    amount: number;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile' | 'check';
    receiptNumber?: string;
    notes?: string;
    paymentDate?: string;
    bankAccountId?: number;
}
