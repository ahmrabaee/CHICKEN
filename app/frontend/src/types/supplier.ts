/**
 * Supplier types — aligned with Prisma Supplier model
 */

export interface Supplier {
    id: number;
    supplierNumber: string;
    name: string;
    nameEn?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    contactPerson?: string | null;
    taxNumber?: string | null;
    paymentTerms?: string | null;
    currentBalance: number;
    creditLimit?: number | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    rating?: number | null;
    notes?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * DTO for creating a new supplier.
 * Note: Backend CreateSupplierDto only accepts 6 fields currently.
 * Extra fields (nameEn, taxNumber, creditLimit, bankName, bankAccountNumber, rating, notes)
 * are included for frontend-readiness — the backend will ignore them until DTO is updated.
 */
export interface CreateSupplierDto {
    name: string;
    nameEn?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    taxNumber?: string;
    creditLimit?: number;
    bankName?: string;
    bankAccountNumber?: string;
    rating?: number;
    notes?: string;
}

/**
 * DTO for updating an existing supplier
 */
export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
    isActive?: boolean;
}

/**
 * Query parameters for listing suppliers
 */
export interface SupplierListQuery {
    page?: number;
    pageSize?: number;
    search?: string;
}

/**
 * Paginated response from list suppliers endpoint
 */
export interface SupplierPaginatedResponse {
    data: Supplier[];
    meta: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    };
}
