
/**
 * Price level enum matching backend PriceLevel
 */
export type PriceLevel = 'standard' | 'wholesale' | 'vip';

/**
 * Customer entity matching backend CustomerResponseDto
 */
export interface Customer {
    id: number;
    customerNumber: string;
    name: string;
    nameEn?: string;
    phone?: string;
    phone2?: string;
    email?: string;
    address?: string;
    creditLimit: number;
    currentBalance: number;
    priceLevel: PriceLevel;
    defaultDiscountPct: number;
    taxNumber?: string;
    notes?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * DTO for creating a customer
 */
export interface CreateCustomerDto {
    name: string;
    nameEn?: string;
    phone?: string;
    phone2?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    priceLevel?: PriceLevel;
    defaultDiscountPct?: number;
    taxNumber?: string;
    notes?: string;
    isActive?: boolean;
}

/**
 * DTO for updating a customer
 */
export interface UpdateCustomerDto {
    name?: string;
    nameEn?: string;
    phone?: string;
    phone2?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    priceLevel?: PriceLevel;
    defaultDiscountPct?: number;
    taxNumber?: string;
    notes?: string;
    isActive?: boolean;
}

/**
 * Query parameters for listing customers
 */
export interface CustomerListQuery {
    search?: string;
    phone?: string;
    priceLevel?: PriceLevel;
    isActive?: boolean;
    hasBalance?: boolean;
    page?: number;
    pageSize?: number;
}

/**
 * Paginated response from list customers endpoint
 */
export interface CustomerPaginatedResponse {
    data: Customer[];
    meta: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    };
}
