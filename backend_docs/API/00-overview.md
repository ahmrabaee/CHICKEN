# Backend API Documentation Overview

> **Version**: 1.0.0  
> **Last Updated**: February 2026  
> **Status**: Implementation Guide

---

## Table of Contents

| # | Module | File | Status | Priority |
|---|--------|------|--------|----------|
| 01 | Authentication & Setup | [01-auth-setup.md](01-auth-setup.md) | ✅ Implemented | P0 |
| 02 | User Management | [02-user-management.md](02-user-management.md) | ✅ Implemented | P0 |
| 03 | Branch Management | [03-branch-management.md](03-branch-management.md) | ✅ Implemented | P1 |
| 04 | Inventory Management | [04-inventory-management.md](04-inventory-management.md) | ✅ Implemented | P0 |
| 05 | Sales & POS | [05-sales-pos.md](05-sales-pos.md) | ✅ Implemented | P0 |
| 06 | Purchases & Suppliers | [06-purchases-suppliers.md](06-purchases-suppliers.md) | ✅ Implemented | P0 |
| 07 | Customers & Debts | [07-customers-debts.md](07-customers-debts.md) | ✅ Implemented | P0 |
| 08 | Payments | [08-payments.md](08-payments.md) | ✅ Implemented | P1 |
| 09 | Returns & Wastage | [09-returns-wastage.md](09-returns-wastage.md) | 🔄 Partial | P2 |
| 10 | Reporting | [10-reporting.md](10-reporting.md) | ✅ Implemented | P1 |
| 11 | Accounting | [11-accounting.md](11-accounting.md) | ✅ Implemented | P1 |
| 12 | Settings & System | [12-settings-system.md](12-settings-system.md) | 🔄 Partial | P2 |

---

## Core Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Tauri + React)                │
├─────────────────────────────────────────────────────────────┤
│                     REST API (NestJS)                       │
├─────────────────────────────────────────────────────────────┤
│                     Prisma ORM                              │
├─────────────────────────────────────────────────────────────┤
│                     SQLite Database                         │
└─────────────────────────────────────────────────────────────┘
```

### Module Dependencies

```
Authentication ─────┐
                    │
User Management ────┼─── Branch Management
                    │
                    ▼
Inventory ◄──────── Items & Categories
    │
    ├───► Sales & POS ──────► Accounting
    │         │
    │         ▼
    │     Customer Debts ◄─── Payments
    │
    ├───► Purchases ─────────► Accounting
    │         │
    │         ▼
    │     Supplier Debts ◄─── Payments
    │
    └───► Returns & Wastage ─► Accounting
```

---

## Core Business Principles

### 1. Inventory Tracking (FIFO)

All inventory is tracked by **lot/batch** with:
- Supplier linkage
- Received date
- Expiry date (optional)
- Cost per unit
- Storage location

**FIFO Rule**: When selling, always allocate from the **oldest available lot first**.

### 2. Automatic Profit Calculation

```
Profit = Sale Price - FIFO Cost

For each sale item:
  1. Find oldest available lots
  2. Calculate weighted average cost
  3. Profit = (selling price × quantity) - (FIFO cost × quantity)
```

### 3. Double-Entry Accounting

Every transaction generates balanced journal entries:

```
Sale Transaction:
  DR: Cash/Accounts Receivable    (what we receive)
  CR: Sales Revenue               (what we earned)
  
  DR: Cost of Goods Sold          (expense recognition)
  CR: Inventory                   (asset reduction)
```

### 4. Role-Based Access Control

| Data Type | Admin | Cashier |
|-----------|-------|---------|
| Profit margins | ✅ | ❌ |
| Cost prices | ✅ | ❌ |
| Supplier prices | ✅ | ❌ |
| Financial reports | ✅ | ❌ |
| Sales data | ✅ | ✅ (own only) |
| Customer data | ✅ | ✅ |
| User management | ✅ | ❌ |

---

## Standard API Patterns

### Authentication

All endpoints (except public) require:
```http
Authorization: Bearer <access_token>
```

### Pagination

List endpoints support:
```http
GET /resource?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

Response format:
```typescript
{
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }
}
```

### Error Response

```typescript
{
  code: string;          // ERROR_CODE
  message: string;       // English message
  messageAr: string;     // Arabic message
  details?: any;         // Additional context
  timestamp: string;     // ISO 8601
  path: string;          // Request path
}
```

### Bilingual Support

All responses include both languages:
```typescript
{
  name: string;      // Arabic (primary)
  nameEn?: string;   // English (secondary)
}
```

---

## Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation |
| `INSUFFICIENT_STOCK` | 400 | Not enough inventory |
| `BUSINESS_RULE_VIOLATION` | 400 | Business logic constraint |
| `SETUP_NOT_COMPLETE` | 400 | System not initialized |

---

## Audit Trail

All significant actions are logged:

```typescript
AuditLog {
  userId: number;
  username: string;
  action: string;        // 'create', 'update', 'delete', 'void'
  entityType: string;    // 'Sale', 'User', 'Purchase'
  entityId: number;
  changes: JSON;         // {before: {...}, after: {...}}
  ipAddress: string;
  timestamp: DateTime;
}
```

### Actions Logged
- User login/logout
- Sale creation/void
- Purchase creation
- Payment recording
- Inventory adjustments
- User management
- Settings changes
- Password changes

---

## Implementation Priority

### Phase 1 (Core - Weeks 1-2)
1. ✅ Authentication & Setup
2. ✅ User Management
3. ✅ Branch Management
4. ✅ Items & Categories

### Phase 2 (Operations - Weeks 3-4)
5. ✅ Inventory Management
6. ✅ Sales & POS
7. ✅ Customers & Debts

### Phase 3 (Purchasing - Weeks 5-6)
8. ✅ Purchases & Suppliers
9. ✅ Payments
10. 🔄 Returns & Wastage (Partial)

### Phase 4 (Reporting - Weeks 7-8)
11. ✅ Reporting
12. ✅ Accounting (with auto journal entries)
13. 🔄 Settings & System

---

## Quick Reference: Numbering Prefixes

| Entity | Prefix | Example |
|--------|--------|---------|
| Sale | SAL- | SAL-0001 |
| Purchase | PUR- | PUR-0001 |
| Payment | PAY- | PAY-0001 |
| Return | RET- | RET-0001 |
| Customer | C | C0001 |
| Supplier | S | S0001 |
| Journal Entry | JE- | JE-0001 |
| Lot/Batch | LOT- | LOT-20260208-001 |

---

## Quick Reference: Account Codes

| Range | Type | Examples |
|-------|------|----------|
| 1xxx | Assets | 1110 Cash, 1120 Bank, 1200 Inventory |
| 2xxx | Liabilities | 2100 Accounts Payable, 2200 VAT Payable |
| 3xxx | Equity | 3100 Capital, 3200 Retained Earnings |
| 4xxx | Revenue | 4100 Sales Revenue, 4200 Other Income |
| 5xxx | Expenses | 5100 COGS, 5200 Operating Expenses |

---

## File Structure

```
backend_docs/API/
├── 00-overview.md           # This file
├── 01-auth-setup.md         # Authentication & First-time Setup
├── 02-user-management.md    # User CRUD & Sessions
├── 03-branch-management.md  # Branch CRUD
├── 04-inventory-management.md # Inventory, Lots, Stock
├── 05-sales-pos.md          # Sales, POS, Invoicing
├── 06-purchases-suppliers.md # Purchases, Suppliers
├── 07-customers-debts.md    # Customers, Debt Management
├── 08-payments.md           # Payment Processing
├── 09-returns-wastage.md    # Returns, Wastage
├── 10-reporting.md          # All Reports
├── 11-accounting.md         # Journal, Chart of Accounts
└── 12-settings-system.md    # System Settings, Alerts
```
