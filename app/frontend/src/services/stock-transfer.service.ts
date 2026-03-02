import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';

export interface StockTransferLineDto {
  itemId: number;
  weightGrams: number;
  unitCost: number;
  lineNumber?: number;
}

export interface CreateStockTransferDto {
  sourceLotId: number;
  expiryDate?: string;
  branchId?: number;
  notes?: string;
  lines: StockTransferLineDto[];
}

export interface SourceLot {
  id: number;
  itemId?: number;
  lotNumber: string;
  itemCode: string;
  itemName: string;
  remainingQuantityGrams: number;
  remainingKg: string;
  unitPurchasePrice: number;
  receivedAt: string;
  expiryDate: string | null;
  purchaseNumber: string | null;
  purchaseDate: string | null;
  supplierName: string | null;
}

export interface TransferrableProduct {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  defaultSalePrice: number;
  defaultPurchasePrice: number | null;
  category: { name: string; defaultShelfLifeDays: number | null };
}

export interface StockTransferLine {
  id: number;
  itemId: number;
  lineNumber: number;
  weightGrams: number;
  unitCost: number;
  lineCostValue: number;
  item?: { code: string; name: string };
}

export interface StockTransfer {
  id: number;
  transferNumber: string;
  sourceLotId: number;
  transferDate: string;
  branchId: number | null;
  expiryDate: string;
  totalWeightGrams: number;
  totalCostValue: number;
  status: string;
  notes: string | null;
  sourceLot?: {
    id: number;
    lotNumber: string;
    item?: { code: string; name: string };
    purchase?: { purchaseNumber: string; supplierName: string };
  };
  lines?: StockTransferLine[];
}

export const stockTransferService = {
  async getSourceLots(branchId?: number, itemId?: number): Promise<SourceLot[]> {
    const params: Record<string, number> = {};
    if (branchId) params.branchId = branchId;
    if (itemId) params.itemId = itemId;
    const response = await axiosInstance.get<SourceLot[]>('/stock-transfer/source-lots', { params });
    return Array.isArray(response.data) ? response.data : (response.data as any)?.data ?? [];
  },

  async getProducts(excludeItemId?: number): Promise<TransferrableProduct[]> {
    const params = excludeItemId ? { excludeItemId } : {};
    const response = await axiosInstance.get<TransferrableProduct[]>('/stock-transfer/products', { params });
    return Array.isArray(response.data) ? response.data : (response.data as any)?.data ?? [];
  },

  async getTransfers(page = 1, pageSize = 20): Promise<{
    items: StockTransfer[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const response = await axiosInstance.get('/stock-transfer', { params: { page, pageSize } });
    const d = response.data as any;
    if (d?.data) return d.data;
    return { items: d?.items ?? [], total: d?.total ?? 0, page, pageSize };
  },

  async getTransfer(id: number): Promise<StockTransfer> {
    const response = await axiosInstance.get<ApiResponse<StockTransfer>>(`/stock-transfer/${id}`);
    return (response.data as any)?.data ?? response.data;
  },

  async createTransfer(data: CreateStockTransferDto): Promise<StockTransfer> {
    const response = await axiosInstance.post<ApiResponse<StockTransfer>>('/stock-transfer', data);
    return (response.data as any)?.data ?? response.data;
  },
};
