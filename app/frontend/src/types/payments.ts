
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
    referenceType: 'sale' | 'purchase' | 'expense' | 'debt';
    referenceId: number;
    partyType?: 'customer' | 'supplier';
    partyId?: number;
    partyName?: string;
    receiptNumber?: string;
    bankTransactionId?: string;
    receivedById?: number;
    branchId?: number;
    isVoided: boolean;
    notes?: string;
    createdAt: string;
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
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile_payment';
    referenceNumber?: string;
    notes?: string;
}

export interface RecordPurchasePaymentDto {
    purchaseId: number;
    amount: number;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'check';
    referenceNumber?: string;
    notes?: string;
}
