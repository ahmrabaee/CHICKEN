# Blueprint 06 — Inventory Valuation & Stock Accounting — Implementation Summary

## Overview

Blueprint 06 (Stock Ledger, Warehouse→Account mapping, Stock vs GL reconciliation) has been applied to the Financial Management Program. The system now has a formal **Stock Ledger Entry (SLE)** as the source of truth for inventory valuation, per-branch stock accounts, and a reconciliation report comparing stock value with GL balance.

---

## Changes Implemented

### 1. Database Schema (Prisma)

| Table | New Fields |
|-------|------------|
| **StockLedgerEntry** | New table: `itemId`, `branchId`, `voucherType`, `voucherId`, `voucherDetailNo`, `qtyChange`, `valuationRate`, `stockValueDifference`, `postingDate`, `postingTime`, `remarks` |
| **Branch** | `stockAccountId` — links branch to its inventory account (1130, 1131, 1132) |
| **Account** | New account: `5320` — مصروف تعديل المخزون (Inventory Adjustment) |

**SLE is immutable** — no update or delete after creation. Corrections via reverse entries only.

### 2. Stock Ledger Module (`src/inventory/stock-ledger/`)

| Service | Responsibility |
|---------|----------------|
| **StockLedgerService** | `createSLE(tx, input)` — creates SLE for each stock movement (sale, purchase, adjustment, void) |
| **StockAccountMapperService** | `getStockAccountCode(branchId)` — returns account code for branch; fallback to 1130 |
| **StockReconciliationService** | `generateStockVsGLReport(asOfDate, branchId?)` — compares SUM(SLE.stock_value_difference) with GL balance per voucher |

### 3. Integration Points

| Flow | SLE Creation | GL Account |
|------|--------------|------------|
| **Sale** | One SLE per sale line (qty negative, stockValueDifference negative) | CR stock account (branch-specific), DR COGS |
| **Sale Void** | Reverse SLE per line (qty positive, stockValueDifference positive) | DR stock account, CR COGS |
| **Purchase Receive** | One SLE per received line (qty positive) | DR stock account |
| **Inventory Adjustment** | One SLE (decrease: negative, increase: positive) | Decrease: DR 5320, CR stock; Increase: DR stock, CR 5320 |

### 4. Accounting Service Updates

- **createSaleJournalEntry** — accepts optional `stockAccountCode` (from StockAccountMapper)
- **createSaleVoidJournalEntry** — accepts optional `stockAccountCode`
- **createPurchaseJournalEntry** — accepts optional `stockAccountCode`
- **createInventoryAdjustmentJournalEntry** — new method for adjustment GL entries (account 5320)

### 5. API

**New endpoint:**
```
GET /reports/stock-vs-gl?asOfDate=YYYY-MM-DD&branchId=1
```

**Response:**
```json
{
  "asOfDate": "2026-02-13",
  "branchId": null,
  "rows": [
    { "voucherType": "sale", "voucherId": 1, "postingDate": "...", "stockValue": -5000, "accountValue": -5000, "difference": 0, "ledgerType": "Stock Ledger Entry" }
  ],
  "summary": { "totalStockValue": -5000, "totalAccountValue": -5000, "totalDifference": 0 }
}
```

### 6. Seed Updates

- Account **5320** (تعديل المخزون) added to chart of accounts
- Branches updated with `stock_account_id` pointing to account 1130 (المخزون)

---

## Migration Path

1. **Apply schema:** `npx prisma db push`
2. **Run seed:** `npx prisma db seed`
3. **Existing data:** Historical transactions (before Blueprint 06) have no SLE. SLE is created only for new transactions.

---

## Key Rules Enforced

| Rule | Status |
|------|--------|
| Every stock movement with accounting impact creates SLE | ✅ Sale, Purchase, Adjustment, Sale Void |
| SLE is immutable | ✅ No update/delete API exposed |
| Branch → Stock Account mapping | ✅ StockAccountMapperService |
| GL uses branch-specific stock account | ✅ Passed to AccountingService |
| Adjustment creates GL entry | ✅ createInventoryAdjustmentJournalEntry |
| Stock vs GL reconciliation report | ✅ GET /reports/stock-vs-gl |

---

## Files Created/Modified

### Created
- `prisma/schema.prisma` — StockLedgerEntry model, Branch.stockAccountId, Account relation
- `src/inventory/stock-ledger/stock-ledger.service.ts`
- `src/inventory/stock-ledger/stock-account-mapper.service.ts`
- `src/inventory/stock-ledger/stock-reconciliation.service.ts`
- `src/inventory/stock-ledger/stock-ledger.module.ts`

### Modified
- `prisma/schema.prisma` — Branch, Item, Account relations
- `prisma/seed.ts` — Account 5320, branch stock_account_id
- `src/inventory/inventory.module.ts` — imports StockLedgerModule
- `src/inventory/inventory.service.ts` — SLE + GL for createAdjustment
- `src/sales/sales.service.ts` — SLE on create and void, stockAccountCode for GL
- `src/purchases/purchases.service.ts` — SLE on receive, stockAccountCode for GL
- `src/purchases/purchases.module.ts` — imports InventoryModule
- `src/accounting/accounting.service.ts` — stockAccountCode param, createInventoryAdjustmentJournalEntry
- `src/reports/reports.controller.ts` — GET stock-vs-gl
- `src/reports/reports.service.ts` — getStockVsGLReport
- `src/reports/reports.module.ts` — imports InventoryModule
- `app/frontend` — Stock vs GL report page, report service, hooks, sidebar link

---

## Frontend

- **Report page:** `/reports/stock-vs-gl` — date picker, summary cards, detail table
- **Sidebar:** "المخزون مقابل الدفاتر" under Reports
- **Branch stock account selector:** Not yet in UI; branches use default 1130 from seed
