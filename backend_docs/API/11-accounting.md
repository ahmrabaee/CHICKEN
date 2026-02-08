# Module 11: Accounting

> **Status**: 📋 To Implement  
> **Priority**: P1 - High  
> **PRD Reference**: Double-Entry Accounting & Financial Statements

---

## Overview

This module provides:
1. **Chart of Accounts** - Account structure
2. **Journal Entries** - Double-entry transactions
3. **Automatic entries** - Generated from business transactions
4. **Financial statements** - Trial Balance, Balance Sheet
5. **Period closing** - Monthly/yearly close

---

## Double-Entry Accounting

All financial transactions create balanced journal entries (Debits = Credits).

```
┌──────────────────────────────────────────────────────────────┐
│                   CHART OF ACCOUNTS                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ASSETS (1xxx)                LIABILITIES (2xxx)             │
│  ├─ 1000 Cash                 ├─ 2000 Accounts Payable      │
│  ├─ 1100 Bank                 └─ 2100 Accrued Expenses      │
│  ├─ 1200 Accounts Receivable                                 │
│  ├─ 1300 Inventory            EQUITY (3xxx)                  │
│  └─ 1400 Prepaid Expenses     ├─ 3000 Owner's Equity        │
│                               └─ 3100 Retained Earnings      │
│  REVENUE (4xxx)                                              │
│  ├─ 4000 Sales Revenue        EXPENSES (5xxx)                │
│  └─ 4100 Other Income         ├─ 5000 Cost of Goods Sold    │
│                               ├─ 5100 Wastage Expense        │
│                               ├─ 5200 Returns Expense        │
│                               └─ 5300 Operating Expenses     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Account

```prisma
model Account {
  id              Int       @id @default(autoincrement())
  code            String    @unique
  name            String
  nameEn          String?   @map("name_en")
  
  accountType     String    @map("account_type")  // 'asset', 'liability', 'equity', 'revenue', 'expense'
  normalBalance   String    @map("normal_balance")  // 'debit', 'credit'
  
  parentId        Int?      @map("parent_id")
  isActive        Boolean   @default(true)
  isSystemAccount Boolean   @default(false) @map("is_system_account")
  
  description     String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  parent          Account?  @relation("AccountHierarchy", fields: [parentId], references: [id])
  children        Account[] @relation("AccountHierarchy")
  
  journalLines    JournalLine[]
}
```

### JournalEntry

```prisma
model JournalEntry {
  id              Int       @id @default(autoincrement())
  entryNumber     String    @unique @map("entry_number")
  entryDate       DateTime  @map("entry_date")
  
  description     String
  descriptionAr   String?   @map("description_ar")
  
  referenceType   String?   @map("reference_type")  // 'Sale', 'Purchase', 'Payment', etc.
  referenceId     Int?      @map("reference_id")
  
  branchId        Int       @map("branch_id")
  createdBy       Int       @map("created_by")
  
  status          String    @default("posted")  // 'draft', 'posted', 'reversed'
  
  totalDebit      Int       @map("total_debit")     // Must equal totalCredit
  totalCredit     Int       @map("total_credit")
  
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  branch          Branch    @relation(fields: [branchId], references: [id])
  creator         User      @relation(fields: [createdBy], references: [id])
  
  lines           JournalLine[]
  
  // Optional relations to source documents
  sale            Sale?     @relation(fields: [referenceId], references: [id], map: "sale_journal")
  purchase        Purchase? @relation(fields: [referenceId], references: [id], map: "purchase_journal")
}
```

### JournalLine

```prisma
model JournalLine {
  id              Int       @id @default(autoincrement())
  journalEntryId  Int       @map("journal_entry_id")
  accountId       Int       @map("account_id")
  
  debitAmount     Int       @default(0) @map("debit_amount")
  creditAmount    Int       @default(0) @map("credit_amount")
  
  description     String?
  
  createdAt       DateTime  @default(now())

  // Relations
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id])
  account         Account      @relation(fields: [accountId], references: [id])
}
```

---

## Standard Journal Entries

### Sale (Cash)
```
DR: Cash (1000)                     40,000
CR: Sales Revenue (4000)            40,000

DR: Cost of Goods Sold (5000)       26,000
CR: Inventory (1300)                26,000
```

### Sale (Credit)
```
DR: Accounts Receivable (1200)      40,000
CR: Sales Revenue (4000)            40,000

DR: Cost of Goods Sold (5000)       26,000
CR: Inventory (1300)                26,000
```

### Purchase (Cash)
```
DR: Inventory (1300)                50,000
CR: Cash (1000)                     50,000
```

### Purchase (Credit)
```
DR: Inventory (1300)                50,000
CR: Accounts Payable (2000)         50,000
```

### Customer Payment
```
DR: Cash (1000)                     30,000
CR: Accounts Receivable (1200)      30,000
```

### Supplier Payment
```
DR: Accounts Payable (2000)         25,000
CR: Cash (1000)                     25,000
```

### Wastage
```
DR: Wastage Expense (5100)          5,000
CR: Inventory (1300)                5,000
```

### Sales Return (Cash Refund)
```
DR: Sales Returns (4000)            10,000
CR: Cash (1000)                     10,000

DR: Inventory (1300)                6,500
CR: Cost of Goods Sold (5000)       6,500
```

---

## API Endpoints

### 11.1 List Accounts (Chart of Accounts)

```http
GET /accounts?type=asset&active=true
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | 'asset', 'liability', 'equity', 'revenue', 'expense' |
| `active` | boolean | Filter by status |
| `search` | string | Search by code or name |

#### Response (Success - 200)

```typescript
{
  accounts: [
    {
      id: 1,
      code: "1000",
      name: "Cash",
      nameAr: "النقدية",
      accountType: "asset",
      normalBalance: "debit",
      parentId: null,
      isActive: true,
      isSystemAccount: true,
      
      // Current balance
      balance: 500000,         // 500.000 SAR
      
      children: [
        {
          id: 2,
          code: "1010",
          name: "Petty Cash",
          nameAr: "صندوق المصروفات النثرية",
          accountType: "asset",
          normalBalance: "debit",
          parentId: 1,
          balance: 10000
        }
      ]
    }
  ],
  
  summary: {
    totalAssets: 1500000,
    totalLiabilities: 500000,
    totalEquity: 1000000,
    totalRevenue: 2000000,
    totalExpenses: 1300000
  }
}
```

---

### 11.2 Create Account

```http
POST /accounts
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  code: string;
  name: string;
  nameAr?: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalBalance: 'debit' | 'credit';
  parentId?: number;
  description?: string;
}
```

#### Response (Success - 201)

```typescript
{
  account: {
    id: 15,
    code: "5400",
    name: "Delivery Expenses",
    nameAr: "مصاريف التوصيل",
    accountType: "expense",
    normalBalance: "debit",
    parentId: null,
    isActive: true,
    isSystemAccount: false
  },
  message: "Account created successfully",
  messageAr: "تم إنشاء الحساب بنجاح"
}
```

---

### 11.3 List Journal Entries

```http
GET /journal-entries?from=2026-02-01&to=2026-02-28&accountId=1000
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | date | Start date |
| `to` | date | End date |
| `accountId` | number | Filter by account |
| `referenceType` | string | 'Sale', 'Purchase', etc. |
| `status` | string | 'draft', 'posted', 'reversed' |

#### Response (Success - 200)

```typescript
{
  entries: [
    {
      id: 100,
      entryNumber: "JE-2026-0100",
      entryDate: "2026-02-08T14:30:00Z",
      
      description: "Sale SAL-0042",
      descriptionAr: "بيع SAL-0042",
      
      referenceType: "Sale",
      referenceId: 42,
      
      branchName: "الفرع الرئيسي",
      createdByName: "admin",
      
      status: "posted",
      
      totalDebit: 66000,
      totalCredit: 66000,
      
      lines: [
        {
          accountCode: "1000",
          accountName: "Cash",
          debitAmount: 40000,
          creditAmount: 0,
          description: "Cash received"
        },
        {
          accountCode: "4000",
          accountName: "Sales Revenue",
          debitAmount: 0,
          creditAmount: 40000,
          description: "Sales revenue"
        },
        {
          accountCode: "5000",
          accountName: "Cost of Goods Sold",
          debitAmount: 26000,
          creditAmount: 0,
          description: "COGS"
        },
        {
          accountCode: "1300",
          accountName: "Inventory",
          debitAmount: 0,
          creditAmount: 26000,
          description: "Inventory reduction"
        }
      ]
    }
  ],
  
  pagination: { ... }
}
```

---

### 11.4 Create Manual Journal Entry

```http
POST /journal-entries
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  entryDate: string;           // ISO date
  description: string;
  descriptionAr?: string;
  branchId: number;
  
  lines: [
    {
      accountId: number;
      debitAmount?: number;
      creditAmount?: number;
      description?: string;
    }
  ];
  
  notes?: string;
}
```

#### Validation

- Total debits must equal total credits
- Each line must have either debit or credit (not both)
- At least 2 lines required

#### Response (Success - 201)

```typescript
{
  entry: {
    id: 150,
    entryNumber: "JE-2026-0150",
    entryDate: "2026-02-08T00:00:00Z",
    description: "Opening balance adjustment",
    status: "posted",
    totalDebit: 10000,
    totalCredit: 10000
  },
  message: "Journal entry created successfully",
  messageAr: "تم إنشاء القيد بنجاح"
}
```

---

### 11.5 Get Trial Balance

```http
GET /accounting/trial-balance?asOf=2026-02-28&branchId=1
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  asOfDate: "2026-02-28",
  branchName: "الفرع الرئيسي",
  
  accounts: [
    {
      code: "1000",
      name: "Cash",
      nameAr: "النقدية",
      accountType: "asset",
      debitBalance: 500000,
      creditBalance: 0
    },
    {
      code: "1200",
      name: "Accounts Receivable",
      nameAr: "ذمم العملاء",
      accountType: "asset",
      debitBalance: 250000,
      creditBalance: 0
    },
    {
      code: "1300",
      name: "Inventory",
      nameAr: "المخزون",
      accountType: "asset",
      debitBalance: 750000,
      creditBalance: 0
    },
    {
      code: "2000",
      name: "Accounts Payable",
      nameAr: "ذمم الموردين",
      accountType: "liability",
      debitBalance: 0,
      creditBalance: 300000
    },
    {
      code: "3000",
      name: "Owner's Equity",
      nameAr: "رأس المال",
      accountType: "equity",
      debitBalance: 0,
      creditBalance: 1000000
    },
    {
      code: "4000",
      name: "Sales Revenue",
      nameAr: "إيرادات المبيعات",
      accountType: "revenue",
      debitBalance: 0,
      creditBalance: 1500000
    },
    {
      code: "5000",
      name: "Cost of Goods Sold",
      nameAr: "تكلفة البضاعة المباعة",
      accountType: "expense",
      debitBalance: 975000,
      creditBalance: 0
    },
    {
      code: "5100",
      name: "Wastage Expense",
      nameAr: "مصروفات الهدر",
      accountType: "expense",
      debitBalance: 25000,
      creditBalance: 0
    }
  ],
  
  totals: {
    totalDebit: 2500000,
    totalCredit: 2500000,
    isBalanced: true
  }
}
```

---

### 11.6 Get Balance Sheet

```http
GET /accounting/balance-sheet?asOf=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  asOfDate: "2026-02-28",
  
  assets: {
    current: {
      cash: 500000,
      accountsReceivable: 250000,
      inventory: 750000,
      totalCurrent: 1500000
    },
    fixed: {
      equipment: 0,
      totalFixed: 0
    },
    totalAssets: 1500000
  },
  
  liabilities: {
    current: {
      accountsPayable: 300000,
      accruedExpenses: 0,
      totalCurrent: 300000
    },
    longTerm: {
      totalLongTerm: 0
    },
    totalLiabilities: 300000
  },
  
  equity: {
    ownersEquity: 1000000,
    retainedEarnings: 200000,     // Net income
    totalEquity: 1200000
  },
  
  totalLiabilitiesAndEquity: 1500000,
  
  isBalanced: true              // Assets = Liabilities + Equity
}
```

---

### 11.7 Get Account Ledger

```http
GET /accounts/:id/ledger?from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  account: {
    id: 1,
    code: "1000",
    name: "Cash",
    nameAr: "النقدية",
    accountType: "asset",
    normalBalance: "debit"
  },
  
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  
  openingBalance: 400000,
  
  transactions: [
    {
      date: "2026-02-08T14:30:00Z",
      entryNumber: "JE-2026-0100",
      description: "Sale SAL-0042",
      referenceType: "Sale",
      referenceId: 42,
      debit: 40000,
      credit: 0,
      balance: 440000
    },
    {
      date: "2026-02-08T16:00:00Z",
      entryNumber: "JE-2026-0101",
      description: "Cash purchase PUR-0015",
      referenceType: "Purchase",
      referenceId: 15,
      debit: 0,
      credit: 50000,
      balance: 390000
    }
  ],
  
  summary: {
    totalDebit: 150000,
    totalCredit: 50000,
    netChange: 100000
  },
  
  closingBalance: 500000
}
```

---

### 11.8 Reverse Journal Entry

```http
POST /journal-entries/:id/reverse
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  reason: string;
}
```

#### Response (Success - 201)

```typescript
{
  originalEntry: {
    id: 100,
    entryNumber: "JE-2026-0100",
    status: "reversed"
  },
  reversalEntry: {
    id: 151,
    entryNumber: "JE-2026-0151",
    description: "Reversal of JE-2026-0100",
    status: "posted",
    totalDebit: 66000,
    totalCredit: 66000
  },
  message: "Entry reversed successfully",
  messageAr: "تم عكس القيد بنجاح"
}
```

---

## System Accounts

These accounts are created automatically and cannot be deleted:

| Code | Name | Name (AR) | Type |
|------|------|-----------|------|
| 1000 | Cash | النقدية | Asset |
| 1100 | Bank | البنك | Asset |
| 1200 | Accounts Receivable | ذمم العملاء | Asset |
| 1300 | Inventory | المخزون | Asset |
| 2000 | Accounts Payable | ذمم الموردين | Liability |
| 3000 | Owner's Equity | رأس المال | Equity |
| 3100 | Retained Earnings | الأرباح المحتجزة | Equity |
| 4000 | Sales Revenue | إيرادات المبيعات | Revenue |
| 4100 | Sales Returns | مردودات المبيعات | Revenue (contra) |
| 5000 | Cost of Goods Sold | تكلفة البضاعة المباعة | Expense |
| 5100 | Wastage Expense | مصروفات الهدر | Expense |
| 5200 | Inventory Adjustment | تسوية المخزون | Expense |

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `GET /accounts` | 📋 To Implement | accounting.controller.ts |
| `POST /accounts` | 📋 To Implement | accounting.controller.ts |
| `PUT /accounts/:id` | 📋 To Implement | accounting.controller.ts |
| `GET /journal-entries` | 📋 To Implement | accounting.controller.ts |
| `POST /journal-entries` | 📋 To Implement | accounting.controller.ts |
| `GET /accounting/trial-balance` | 📋 To Implement | accounting.controller.ts |
| `GET /accounting/balance-sheet` | 📋 To Implement | accounting.controller.ts |
| `GET /accounts/:id/ledger` | 📋 To Implement | accounting.controller.ts |
| `POST /journal-entries/:id/reverse` | 📋 To Implement | accounting.controller.ts |
