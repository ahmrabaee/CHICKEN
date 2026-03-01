
/**
 * Debts Module Types
 * Matches backend DTOs from debts controller and Prisma Debt model.
 *
 * Field-name mapping note:
 *   DB field          → DTO field
 *   direction         → debtType
 *   totalAmount       → originalAmount  (integer cents)
 *   amountPaid        → amountPaid      (integer cents)
 *   partyName         → partyName + customerName / supplierName
 *   debtNumber        → debtNumber + saleNumber / purchaseNumber (by sourceType)
 */

export interface Debt {
    id: number;
    /** Maps to Prisma `direction` ('receivable' | 'payable') */
    debtType: 'receivable' | 'payable';
    /** Unique identifier, e.g. "DBT-0001" */
    debtNumber?: string;
    /** The unified party name from `partyName` */
    partyName?: string;
    /** Populated when partyType === 'customer' */
    customerName?: string;
    /** Populated when partyType === 'supplier' */
    supplierName?: string;
    partyType?: string;
    partyId?: number;
    /** sourceType === 'sale': debtNumber forwarded here */
    saleNumber?: string;
    /** sourceType === 'purchase': debtNumber forwarded here */
    purchaseNumber?: string;
    sourceType?: string;
    sourceId?: number;
    /** Integer minor units (e.g. agoras). Maps to Prisma `totalAmount`. */
    originalAmount: number;
    /** Integer minor units. Always >= 0. Computed as totalAmount - amountPaid. */
    remainingAmount: number;
    /** Integer minor units. Maps to Prisma `amountPaid`. */
    amountPaid?: number;
    status: 'outstanding' | 'partial' | 'settled' | 'written_off';
    dueDate?: string;
    isOverdue?: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DebtQuery {
    customerId?: number;
    supplierId?: number;
    status?: string;
    search?: string;
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
