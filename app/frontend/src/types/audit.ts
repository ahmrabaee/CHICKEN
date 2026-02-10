
/**
 * Audit Module Types
 */

export interface AuditLog {
    id: number;
    userId: number;
    userName?: string;
    action: string;
    entityType: string;
    entityId?: number;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

export interface AuditQuery {
    userId?: number;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}

export interface ActionCount {
    action: string;
    count: number;
}
