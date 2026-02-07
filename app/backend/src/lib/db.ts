/**
 * Database Utilities
 * 
 * Helper functions for common database operations.
 * All functions use the Prisma client singleton.
 * 
 * @module lib/db
 */

import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client/index.js';

type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// =============================================================================
// NUMBER GENERATION
// =============================================================================

/**
 * Generate the next sequential number for a given prefix
 * Thread-safe using database transactions
 * 
 * @param prefix - The number prefix (e.g., 'SAL-')
 * @param settingKey - The setting key for the counter (e.g., 'numbering.sale_next')
 * @returns Formatted number string (e.g., 'SAL-000001')
 */
export async function generateNextNumber(
  prefix: string,
  settingKey: string
): Promise<string> {
  return prisma.$transaction(async (tx: TransactionClient) => {
    const setting = await tx.systemSetting.findUnique({
      where: { key: settingKey },
    });

    const currentNumber = setting ? parseInt(setting.value, 10) : 1;
    const formattedNumber = `${prefix}${currentNumber.toString().padStart(6, '0')}`;

    await tx.systemSetting.upsert({
      where: { key: settingKey },
      update: { value: (currentNumber + 1).toString() },
      create: {
        key: settingKey,
        value: (currentNumber + 1).toString(),
        dataType: 'number',
        settingGroup: 'numbering',
      },
    });

    return formattedNumber;
  });
}

/**
 * Generate sale invoice number
 */
export async function generateSaleNumber(): Promise<string> {
  const prefix = await getSetting('numbering.sale_prefix', 'SAL-');
  return generateNextNumber(prefix, 'numbering.sale_next');
}

/**
 * Generate purchase order number
 */
export async function generatePurchaseNumber(): Promise<string> {
  const prefix = await getSetting('numbering.purchase_prefix', 'PUR-');
  return generateNextNumber(prefix, 'numbering.purchase_next');
}

/**
 * Generate payment receipt number
 */
export async function generatePaymentNumber(): Promise<string> {
  const prefix = await getSetting('numbering.payment_prefix', 'PAY-');
  return generateNextNumber(prefix, 'numbering.payment_next');
}

/**
 * Generate expense number
 */
export async function generateExpenseNumber(): Promise<string> {
  const prefix = await getSetting('numbering.expense_prefix', 'EXP-');
  return generateNextNumber(prefix, 'numbering.expense_next');
}

/**
 * Generate customer number
 */
export async function generateCustomerNumber(): Promise<string> {
  const prefix = await getSetting('numbering.customer_prefix', 'C');
  return generateNextNumber(prefix, 'numbering.customer_next');
}

/**
 * Generate supplier number
 */
export async function generateSupplierNumber(): Promise<string> {
  const prefix = await getSetting('numbering.supplier_prefix', 'S');
  return generateNextNumber(prefix, 'numbering.supplier_next');
}

/**
 * Generate lot number with date prefix
 */
export async function generateLotNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LOT-${today}-`;
  
  // Count existing lots for today
  const count = await prisma.inventoryLot.count({
    where: {
      lotNumber: {
        startsWith: prefix,
      },
    },
  });
  
  return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
}

// =============================================================================
// SETTINGS
// =============================================================================

/**
 * Get a system setting value
 * 
 * @param key - Setting key
 * @param defaultValue - Default value if not found
 * @returns Setting value
 */
export async function getSetting(
  key: string,
  defaultValue: string = ''
): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });
  return setting?.value ?? defaultValue;
}

/**
 * Get a numeric setting value
 */
export async function getSettingNumber(
  key: string,
  defaultValue: number = 0
): Promise<number> {
  const value = await getSetting(key, defaultValue.toString());
  return parseInt(value, 10);
}

/**
 * Get a boolean setting value
 */
export async function getSettingBoolean(
  key: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const value = await getSetting(key, defaultValue.toString());
  return value.toLowerCase() === 'true';
}

/**
 * Update a system setting
 */
export async function updateSetting(
  key: string,
  value: string
): Promise<void> {
  await prisma.systemSetting.update({
    where: { key },
    data: { value },
  });
}

// =============================================================================
// FIFO INVENTORY HELPERS
// =============================================================================

/**
 * Get available lots for an item in FIFO order
 * 
 * @param itemId - Item ID
 * @param branchId - Optional branch filter
 * @returns Available lots sorted by received date
 */
export async function getAvailableLots(
  itemId: number,
  branchId?: number
) {
  return prisma.inventoryLot.findMany({
    where: {
      itemId,
      remainingQuantityGrams: { gt: 0 },
      ...(branchId !== undefined ? { branchId } : {}),
    },
    orderBy: [
      { receivedAt: 'asc' },
      { id: 'asc' },
    ],
  });
}

/**
 * Allocate quantity from lots using FIFO
 * Returns allocations for cost tracking
 * 
 * @param itemId - Item ID
 * @param quantityGrams - Quantity to allocate (grams)
 * @param branchId - Optional branch filter
 * @returns Array of allocations with lot and quantity
 */
export async function allocateFIFO(
  itemId: number,
  quantityGrams: number,
  branchId?: number
): Promise<Array<{
  lotId: number;
  quantityGrams: number;
  unitCost: number;
  totalCost: number;
}>> {
  const lots = await getAvailableLots(itemId, branchId);
  const allocations: Array<{
    lotId: number;
    quantityGrams: number;
    unitCost: number;
    totalCost: number;
  }> = [];

  let remaining = quantityGrams;

  for (const lot of lots) {
    if (remaining <= 0) break;

    const allocateQty = Math.min(lot.remainingQuantityGrams, remaining);
    const totalCost = Math.round((allocateQty * lot.unitPurchasePrice) / 1000); // grams to kg

    allocations.push({
      lotId: lot.id,
      quantityGrams: allocateQty,
      unitCost: lot.unitPurchasePrice,
      totalCost,
    });

    remaining -= allocateQty;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock. Short by ${remaining} grams`);
  }

  return allocations;
}

/**
 * Deduct quantity from lots (call after allocateFIFO)
 * Updates lot remaining quantities within a transaction
 */
export async function deductFromLots(
  allocations: Array<{ lotId: number; quantityGrams: number }>
): Promise<void> {
  await prisma.$transaction(async (tx: TransactionClient) => {
    for (const alloc of allocations) {
      await tx.inventoryLot.update({
        where: { id: alloc.lotId },
        data: {
          remainingQuantityGrams: {
            decrement: alloc.quantityGrams,
          },
        },
      });
    }
  });
}

/**
 * Update inventory summary after stock changes
 */
export async function updateInventorySummary(itemId: number): Promise<void> {
  const lots = await prisma.inventoryLot.findMany({
    where: {
      itemId,
      remainingQuantityGrams: { gt: 0 },
    },
  });

  const totalGrams = lots.reduce((sum: number, lot) => sum + lot.remainingQuantityGrams, 0);
  const totalValue = lots.reduce(
    (sum: number, lot) => sum + Math.round((lot.remainingQuantityGrams * lot.unitPurchasePrice) / 1000),
    0
  );
  const averageCost = totalGrams > 0 ? Math.round((totalValue * 1000) / totalGrams) : 0;

  await prisma.inventory.upsert({
    where: { itemId },
    update: {
      currentQuantityGrams: totalGrams,
      totalValue,
      averageCost,
    },
    create: {
      itemId,
      currentQuantityGrams: totalGrams,
      totalValue,
      averageCost,
    },
  });
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: {
  userId?: number;
  username: string;
  action: string;
  entityType: string;
  entityId?: number;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  branchId?: number;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      username: params.username,
      action: params.action,
      entityType: params.entityType,
      changes: params.changes ? JSON.stringify(params.changes) : null,
      ...(params.userId !== undefined && { userId: params.userId }),
      ...(params.entityId !== undefined && { entityId: params.entityId }),
      ...(params.ipAddress !== undefined && { ipAddress: params.ipAddress }),
      ...(params.userAgent !== undefined && { userAgent: params.userAgent }),
      ...(params.branchId !== undefined && { branchId: params.branchId }),
    },
  });
}

// =============================================================================
// CURRENCY & WEIGHT HELPERS
// =============================================================================

/**
 * Convert major units (SAR) to minor units (halalas)
 */
export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

/**
 * Convert minor units (halalas) to major units (SAR)
 */
export function toMajorUnits(minor: number): number {
  return minor / 100;
}

/**
 * Convert kilograms to grams
 */
export function toGrams(kg: number): number {
  return Math.round(kg * 1000);
}

/**
 * Convert grams to kilograms
 */
export function toKilograms(grams: number): number {
  return grams / 1000;
}

/**
 * Format currency for display
 */
export function formatCurrency(minorUnits: number, symbol = 'ر.س'): string {
  const major = toMajorUnits(minorUnits);
  return `${major.toFixed(2)} ${symbol}`;
}

/**
 * Format weight for display
 */
export function formatWeight(grams: number): string {
  const kg = toKilograms(grams);
  return `${kg.toFixed(3)} كجم`;
}

export { prisma };
