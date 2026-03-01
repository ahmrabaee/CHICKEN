
import { PaginationMeta } from './api';

export interface Category {
    id: number;
    code: string;
    name: string;
    nameEn?: string;
    description?: string;
    itemCount?: number;
    displayOrder?: number;
    isActive?: boolean;
}

export interface ItemInventorySummary {
    currentQuantityGrams: number;
    reservedQuantityGrams: number;
    totalValue: number;
    averageCost: number;
    lastRestockedAt?: string;
    lastSoldAt?: string;
}

export interface Item {
    id: number;
    code: string;
    barcode?: string;
    name: string;
    nameEn?: string;
    description?: string;
    categoryId: number;
    categoryName?: string;
    unitOfMeasure: string;
    defaultSalePrice: number;
    defaultPurchasePrice?: number;
    /** محسوب في الباك: من المخزون إن وُجد، وإلا سعر الشراء المتوقع. للعرض فقط. */
    effectiveCostPrice?: number;
    taxRatePct?: number;
    minStockLevel?: number;
    maxStockLevel?: number;
    shelfLifeDays?: number;
    storageLocation?: string;
    requiresScale: boolean;
    allowNegativeStock: boolean;
    imageUrl?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    category?: Category;
    inventory?: ItemInventorySummary;
}

export interface CreateItemDto {
    code?: string;
    barcode?: string;
    name: string;
    nameEn?: string;
    description?: string;
    categoryId: number;
    defaultSalePrice: number;
    defaultPurchasePrice?: number;
    taxRatePct?: number;
    minStockLevelGrams?: number;
    maxStockLevelGrams?: number;
    shelfLifeDays?: number;
    storageLocation?: string;
    requiresScale?: boolean;
    allowNegativeStock?: boolean;
    imageUrl?: string;
    isActive?: boolean;
    initialQuantityGrams?: number;
    initialCostPrice?: number;
}

export interface InventoryLot {
    lotId: number;
    lotNumber: string;
    itemId: number;
    branchId: number;
    supplierId?: number;
    supplierName?: string;
    receivedAt: string;
    expiryDate?: string;
    quantity: number;
    costPerUnit?: number; // Only for admin
    storageLocation?: string;
    isExpired: boolean;
    daysUntilExpiry?: number | null;
}

export interface InventoryItem {
    id: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    itemNameEn?: string;
    barcode?: string;
    categoryName: string;
    branchId: number;
    branchName: string;
    totalQuantity: number;
    availableQuantity: number;
    unitOfMeasure: string;
    minStockLevel: number;
    isLowStock: boolean;
    sellingPrice: number;
    avgCostPrice?: number; // Only for admin
    batches: InventoryLot[];
}

export interface InventoryQuery {
    branchId?: number;
    categoryId?: number;
    lowStock?: boolean;
    expiringSoon?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface ItemQuery {
    categoryId?: number;
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

export interface AdjustStockDto {
    branchId?: number;
    itemId: number;
    adjustmentType: 'increase' | 'decrease';
    /** Quantity in grams (backend expects quantityGrams) */
    quantityGrams: number;
    reason: string;
    reference?: string;
    lotNumber?: string;
    lotId?: number;
    supplierId?: number;
    expiryDate?: string;
    /** Unit cost in minor units per kg (backend: unitCost) */
    unitCost?: number;
    storageLocation?: string;
}

export interface TransferStockDto {
    fromLotId: number;
    toItemId: number;
    quantity: number;
    branchId: number;
    reason: string;
}

export interface CheckAvailabilityRequest {
    branchId: number;
    items: Array<{
        itemId: number;
        quantity: number;
    }>;
}

export interface AvailabilityResult {
    available: boolean;
    items: Array<{
        itemId: number;
        itemName: string;
        requestedQty: number;
        availableQty: number;
        isAvailable: boolean;
        allocations: Array<{
            lotId: number;
            lotNumber: string;
            quantity: number;
            costPerUnit: number;
        }>;
    }>;
}
