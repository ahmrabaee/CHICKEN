
import { Supplier } from "./supplier";
import { Branch } from "./branch";

/**
 * Expenses Module Types
 * Matches backend DTOs in expenses/dto/expense.dto.ts and Prisma Expense model
 */

export interface ExpenseCategory {
    id: number;
    code: string;
    name: string;
    nameEn?: string | null;
    accountCode?: string | null;
    parentCategoryId?: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    parentCategory?: ExpenseCategory | null;
}

export interface Expense {
    id: number;
    expenseNumber: string;
    expenseDate: string;
    expenseType: string; // 'operational', 'personal', 'payroll', 'utilities', 'rent', 'maintenance', 'other'
    categoryId?: number | null;
    amount: number;
    taxAmount: number;
    description: string;
    supplierId?: number | null;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    isApproved: boolean;
    /** Blueprint 03: 0=Draft, 1=Submitted, 2=Cancelled */
    docstatus?: number;
    approvedById?: number | null;
    approvedAt?: string | null;
    branchId?: number | null;
    attachmentUrl?: string | null;
    notes?: string | null;
    isPersonal: boolean; // Computed or flags based on expenseType
    createdAt: string;
    updatedAt: string;
    createdById?: number | null;

    // Relations (included in some responses)
    category?: ExpenseCategory | null;
    supplier?: Supplier | null;
    branch?: Branch | null;
    createdBy?: {
        id: number;
        username: string;
        fullName: string;
        employeeNumber?: string;
    } | null;
    approvedBy?: {
        id: number;
        username: string;
        fullName: string;
        employeeNumber?: string;
    } | null;

    // UI Helper
    createdByName?: string; // Some hooks might flatten this
}

export interface ExpenseQuery {
    expenseType?: string;
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
}

export interface CreateExpenseDto {
    categoryId: number;
    description: string;
    amount: number;
    taxAmount?: number;
    expenseDate?: string;
    expenseType?: string;
    supplierId?: number;
    paymentMethod?: string;
    referenceNumber?: string;
    branchId?: number;
    bankAccountId?: number;
    attachmentUrl?: string;
    notes?: string;
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> {
    isApproved?: boolean;
}

export interface ExpenseSummary {
    expenseType: string;
    totalAmount: number;
}
