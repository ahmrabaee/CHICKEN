/**
 * Wastage Module Types
 * Stage 1: Aligned with backend DTOs and Prisma WastageRecord + list/detail API responses
 */

export type WastageReason = "expired" | "damaged" | "spoiled" | "processing_loss" | "other";

/** List item / GET by ID — full shape from backend (include item, lot, recordedBy, approvedBy) */
export interface WastageRecord {
  id: number;
  itemId: number;
  lotId: number | null;
  branchId: number | null;
  weightGrams: number;
  wastageType: string;
  reason: string;
  estimatedCostValue: number;
  photoUrl: string | null;
  recordedById: number;
  approvedById: number | null;
  approvedAt: string | null;
  wastageDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  item?: { id: number; name: string; code: string };
  lot?: { id: number; lotNumber: string; remainingQuantityGrams?: number } | null;
  recordedBy?: { id: number; fullName: string };
  approvedBy?: { id: number; fullName: string } | null;
}

export interface WastageQuery {
  page?: number;
  pageSize?: number;
}

/** POST /wastage — CreateWastageDto (backend uses quantityGrams) */
export interface CreateWastageDto {
  lotId: number;
  quantityGrams: number;
  reason: WastageReason;
  notes?: string;
}
