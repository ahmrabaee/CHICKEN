/**
 * Chicken Shop POS Backend
 * Main entry point
 * 
 * @module index
 */

export * from './lib/prisma.js';
export * from './lib/db.js';

// Re-export Prisma types for convenience
export type {
  Branch,
  Role,
  User,
  UserRole,
  Category,
  Item,
  Inventory,
  InventoryLot,
  StockMovement,
  WastageRecord,
  Customer,
  Supplier,
  Sale,
  SaleLine,
  SaleLineCostAllocation,
  Purchase,
  PurchaseLine,
  Payment,
  Debt,
  ExpenseCategory,
  Expense,
  Account,
  JournalEntry,
  JournalEntryLine,
  SystemSetting,
  AuditLog,
  SchemaVersion,
} from '@prisma/client';

console.log('Chicken Shop Backend initialized');
