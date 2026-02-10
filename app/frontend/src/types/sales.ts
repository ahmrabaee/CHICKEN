
/**
 * Sales Module Types
 * Matches backend DTOs in sales/dto/sale.dto.ts and Prisma Sale/SaleLine models
 */

// ─── Response Types ──────────────────────────────────────────

export interface SaleLineCostAllocation {
    id: number;
    lotId: number;
    lotNumber?: string;
    quantityAllocatedGrams: number;
    unitCost: number;
    totalCost: number;
}

export interface SaleLine {
    id: number;
    lineNumber: number;
    itemId: number;
    itemName: string;
    itemCode: string;
    weightGrams: number;
    pricePerKg: number;
    discountAmount: number;
    netPricePerKg: number;
    taxRatePct: number;
    taxAmount: number;
    lineTotalAmount: number;
    costPerKg: number;
    lineTotalCost: number;
    lineProfit?: number;
    metadata?: string;
    costAllocations?: SaleLineCostAllocation[];
}

export interface SalePayment {
    id: number;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
}

export interface Sale {
    id: number;
    saleNumber: string;
    saleDate: string;
    saleType: 'cash' | 'credit' | 'mixed';
    customerId?: number;
    customerName?: string;
    customerPhone?: string;
    cashierId: number;
    branchId?: number;
    grossTotalAmount: number;
    discountAmount: number;
    discountPct?: number;
    taxAmount: number;
    totalAmount: number;
    totalCost: number;
    totalProfit: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    amountPaid: number;
    amountDue?: number;
    dueDate?: string;
    isVoided: boolean;
    voidedAt?: string;
    voidedById?: number;
    voidReason?: string;
    notes?: string;
    metadata?: string;
    createdAt: string;
    updatedAt: string;
    createdById?: number;
    // Relations (populated in detail view)
    saleLines?: SaleLine[];
    payments?: SalePayment[];
}

// ─── Query Types ─────────────────────────────────────────────

export interface SaleQuery {
    customerId?: number;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

// ─── DTO Types (Create/Mutate) ───────────────────────────────

export interface CreateSaleLineDto {
    itemId: number;
    weightGrams: number;
    pricePerKg: number;
    discountAmount?: number;
}

export interface CreateSalePaymentDto {
    amount: number;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile' | 'check';
}

export interface CreateSaleDto {
    customerId?: number;
    customerName?: string;
    customerPhone?: string;
    saleType: 'cash' | 'credit' | 'mixed';
    discountAmount?: number;
    discountPct?: number;
    dueDate?: string;
    notes?: string;
    lines: CreateSaleLineDto[];
    payments?: CreateSalePaymentDto[];
}

export interface VoidSaleDto {
    reason: string;
}

export interface AddPaymentDto {
    amount: number;
    paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile' | 'check';
    referenceNumber?: string;
    notes?: string;
}

// ─── Receipt Type ────────────────────────────────────────────

export interface SaleReceipt {
    sale: Sale;
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
    cashierName?: string;
    branchName?: string;
}
