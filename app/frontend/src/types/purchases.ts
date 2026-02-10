
/**
 * Purchases Module Types
 * Matches backend DTOs in purchases/dto/purchase.dto.ts and Prisma Purchase/PurchaseLine models
 */

// ─── Response Types ──────────────────────────────────────────

export interface PurchaseLine {
    id: number;
    lineNumber: number;
    itemId: number;
    itemName: string;
    itemCode: string;
    weightGrams: number;
    pricePerKg: number;
    lineTotalAmount: number;
    receivedWeightGrams: number;
    isLiveBird: boolean;
}

export interface Purchase {
    id: number;
    purchaseNumber: string;
    purchaseDate: string;
    supplierId: number;
    supplierName: string;
    status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
    totalAmount: number;
    taxAmount: number;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    dueDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    createdById?: number;
    purchaseLines?: PurchaseLine[];
    payments?: any[];
}

// ─── Query Types ─────────────────────────────────────────────

export interface PurchaseQuery {
    supplierId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

// ─── DTO Types (Create/Mutate) ───────────────────────────────

export interface CreatePurchaseLineDto {
    itemId: number;
    weightGrams: number;
    pricePerKg: number;
    isLiveBird?: boolean;
}

export interface CreatePurchaseDto {
    supplierId: number;
    purchaseDate?: string;
    dueDate?: string;
    taxAmount?: number;
    notes?: string;
    lines: CreatePurchaseLineDto[];
}

export interface ReceiveLineDto {
    purchaseLineId: number;
    receivedWeightGrams: number;
    lotNumber?: string;
}

export interface ReceivePurchaseDto {
    lines: ReceiveLineDto[];
}
