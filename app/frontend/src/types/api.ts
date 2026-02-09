
/**
 * Generic API response structure from the backend
 */
export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/**
 * Generic API response structure from the backend
 */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta: {
        timestamp: string;
        requestId?: string;
    };
    pagination?: PaginationMeta;
}
