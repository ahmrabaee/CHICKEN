
/**
 * Branch entity matching backend API specification
 */
export interface Branch {
    id: number;
    code: string;
    name: string;
    nameEn?: string;
    address?: string;
    phone?: string;
    isMainBranch: boolean;
    isActive: boolean;
    stockAccountId?: number | null;
    stockAccount?: { id: number; code: string; name: string };
    userCount?: number;
    createdAt: string;
    updatedAt?: string;
    users?: BranchUser[];
}

export interface BranchUser {
    id: number;
    username: string;
    fullName: string;
}

/**
 * DTO for creating a branch
 */
export interface CreateBranchDto {
    code: string;
    name: string;
    nameEn?: string;
    address?: string;
    phone?: string;
    stockAccountId?: number;
}

/**
 * DTO for updating a branch
 */
export interface UpdateBranchDto {
    name?: string;
    nameEn?: string;
    address?: string;
    phone?: string;
    stockAccountId?: number | null;
}

/**
 * Response from list branches endpoint
 */
export interface BranchListResponse {
    branches: Branch[];
}

/**
 * Response from single branch operations
 */
export interface BranchResponse {
    branch?: Branch;
    message?: string;
    messageAr?: string;
}
