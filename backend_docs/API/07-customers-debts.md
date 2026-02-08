# Module 07: Customers & Debts

> **Status**: 📋 To Implement  
> **Priority**: P0 - Critical  
> **PRD Reference**: Customer Management & Debt Tracking (High)

---

## Overview

This module handles:
1. **Customer management** - Customer information and tracking
2. **Debt tracking** - Track amounts owed by customers
3. **Credit limits** - Optional credit limits per customer
4. **Payment collection** - Link payments to debts
5. **Customer statements** - Full transaction history

---

## Customer & Debt Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   CUSTOMER DEBT LIFECYCLE                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SALE ON CREDIT                                           │
│     Customer: أحمد محمد (Ahmad)                              │
│     Sale Total: 100.000 SAR                                  │
│     Payment: Credit (آجل)                                    │
│     ↓                                                        │
│     DEBT CREATED: 100.000 SAR (Due: 7 days)                 │
│                                                              │
│  2. PARTIAL PAYMENT                                          │
│     Payment: 60.000 SAR                                      │
│     ↓                                                        │
│     DEBT REMAINING: 40.000 SAR                              │
│                                                              │
│  3. FINAL PAYMENT                                            │
│     Payment: 40.000 SAR                                      │
│     ↓                                                        │
│     DEBT STATUS: Paid ✓                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Customer

```prisma
model Customer {
  id              Int       @id @default(autoincrement())
  code            String    @unique
  name            String
  nameEn          String?   @map("name_en")
  phone           String?
  email           String?
  address         String?
  
  creditLimit     Int?      @map("credit_limit")      // Maximum allowed debt
  currentBalance  Int       @default(0) @map("current_balance")  // Current debt
  
  isActive        Boolean   @default(true)
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  sales           Sale[]
  debts           Debt[]
  payments        Payment[]
}
```

### Debt

```prisma
model Debt {
  id              Int       @id @default(autoincrement())
  customerId      Int       @map("customer_id")
  saleId          Int?      @map("sale_id")           // Which sale created this
  branchId        Int       @map("branch_id")
  
  originalAmount  Int       @map("original_amount")
  remainingAmount Int       @map("remaining_amount")
  
  dueDate         DateTime  @map("due_date")
  status          String    @default("unpaid")        // 'unpaid', 'partial', 'paid', 'overdue', 'cancelled'
  
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  customer        Customer  @relation(fields: [customerId], references: [id])
  sale            Sale?     @relation(fields: [saleId], references: [id])
  branch          Branch    @relation(fields: [branchId], references: [id])
  
  paymentAllocations PaymentAllocation[]
}
```

---

## API Endpoints

### 7.1 Create Customer

```http
POST /customers
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  name: string;                  // Arabic name
  nameEn?: string;               // English name
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;          // Minor units (optional)
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  customer: {
    id: 10,
    code: "CUS-0010",
    name: "أحمد محمد",
    nameEn: "Ahmad Mohammed",
    phone: "0501234567",
    email: "ahmad@email.com",
    address: "حي الملز، الرياض",
    creditLimit: 100000,         // 100.000 SAR limit
    currentBalance: 0,
    isActive: true,
    notes: null
  },
  message: "Customer created successfully",
  messageAr: "تم إنشاء العميل بنجاح"
}
```

#### Business Logic

```typescript
async createCustomer(dto: CreateCustomerDto) {
  // Generate customer code
  const code = await generateCustomerCode();
  
  // Check for duplicate phone (if provided)
  if (dto.phone) {
    const existing = await prisma.customer.findFirst({
      where: { phone: dto.phone }
    });
    
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PHONE',
        message: 'Customer with this phone already exists',
        messageAr: 'يوجد عميل بهذا الرقم مسبقاً'
      });
    }
  }
  
  return prisma.customer.create({
    data: {
      code,
      ...dto
    }
  });
}
```

---

### 7.2 List Customers

```http
GET /customers?search=أحمد&hasDebt=true&isActive=true
```

**Access**: 🔒 Admin, Cashier (read-only)

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name, code, phone |
| `isActive` | boolean | Filter by status |
| `hasDebt` | boolean | Only customers with balance > 0 |
| `overdueOnly` | boolean | Only customers with overdue debts |

#### Response (Success - 200)

```typescript
{
  customers: [
    {
      id: 10,
      code: "CUS-0010",
      name: "أحمد محمد",
      nameEn: "Ahmad Mohammed",
      phone: "0501234567",
      creditLimit: 100000,
      currentBalance: 40000,     // Currently owes 40.000 SAR
      availableCredit: 60000,    // 60.000 SAR more available
      isActive: true,
      lastSaleDate: "2026-02-08",
      hasOverdueDebt: false
    }
  ],
  
  summary: {
    totalCustomers: 50,
    customersWithDebt: 15,
    totalOutstandingDebt: 750000  // 750.000 SAR total receivable
  },
  
  pagination: { ... }
}
```

---

### 7.3 Get Customer Details

```http
GET /customers/:id
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  customer: {
    id: 10,
    code: "CUS-0010",
    name: "أحمد محمد",
    nameEn: "Ahmad Mohammed",
    phone: "0501234567",
    email: "ahmad@email.com",
    address: "حي الملز، الرياض",
    
    creditLimit: 100000,
    currentBalance: 40000,
    availableCredit: 60000,
    
    isActive: true,
    notes: null,
    
    createdAt: "2025-01-15T10:00:00Z",
    
    // Statistics
    stats: {
      totalSales: 25,
      totalSpent: 250000,        // Lifetime purchases
      totalPaid: 210000,         // Lifetime payments
      avgSaleAmount: 10000
    }
  },
  
  // Active debts
  debts: [
    {
      id: 15,
      saleId: 42,
      saleInvoice: "SAL-0042",
      originalAmount: 40000,
      remainingAmount: 40000,
      dueDate: "2026-02-15",
      status: "unpaid",
      daysUntilDue: 7,
      isOverdue: false
    }
  ],
  
  // Recent sales
  recentSales: [
    {
      id: 42,
      invoiceNumber: "SAL-0042",
      date: "2026-02-08T14:30:00Z",
      totalAmount: 40000,
      paymentMethod: "credit"
    }
  ]
}
```

---

### 7.4 Update Customer

```http
PUT /customers/:id
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  name?: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  notes?: string;
}
```

---

### 7.5 Deactivate Customer

```http
PUT /customers/:id/deactivate
```

**Access**: 🔒 Admin only

#### Business Logic

```typescript
async deactivateCustomer(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    throw new NotFoundException('Customer not found');
  }

  // Check for outstanding balance
  if (customer.currentBalance > 0) {
    throw new BadRequestException({
      code: 'HAS_OUTSTANDING_DEBT',
      message: 'Cannot deactivate customer with outstanding debt',
      messageAr: 'لا يمكن إلغاء تفعيل عميل لديه ديون متبقية',
      balance: customer.currentBalance
    });
  }

  return prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false }
  });
}
```

---

### 7.6 List Customer Debts

```http
GET /debts?customerId=10&status=unpaid&overdue=true
```

**Access**: 🔒 Admin, Cashier

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `customerId` | number | Filter by customer |
| `branchId` | number | Filter by branch |
| `status` | string | 'unpaid', 'partial', 'paid', 'overdue' |
| `overdue` | boolean | Only overdue debts |
| `from` | date | Created after date |
| `to` | date | Created before date |

#### Response (Success - 200)

```typescript
{
  debts: [
    {
      id: 15,
      customerId: 10,
      customerName: "أحمد محمد",
      customerPhone: "0501234567",
      
      saleId: 42,
      saleInvoice: "SAL-0042",
      saleDate: "2026-02-08T14:30:00Z",
      
      branchName: "الفرع الرئيسي",
      
      originalAmount: 100000,
      paidAmount: 60000,
      remainingAmount: 40000,
      
      dueDate: "2026-02-15",
      daysUntilDue: 7,
      daysOverdue: 0,
      
      status: "partial",
      isOverdue: false
    }
  ],
  
  summary: {
    totalDebts: 25,
    totalOriginalAmount: 500000,
    totalPaidAmount: 300000,
    totalRemainingAmount: 200000,
    overdueCount: 5,
    overdueAmount: 75000
  },
  
  pagination: { ... }
}
```

---

### 7.7 Get Debt Details

```http
GET /debts/:id
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  debt: {
    id: 15,
    
    customer: {
      id: 10,
      code: "CUS-0010",
      name: "أحمد محمد",
      phone: "0501234567"
    },
    
    sale: {
      id: 42,
      invoiceNumber: "SAL-0042",
      saleDate: "2026-02-08T14:30:00Z",
      totalAmount: 100000
    },
    
    branchName: "الفرع الرئيسي",
    
    originalAmount: 100000,
    remainingAmount: 40000,
    
    dueDate: "2026-02-15",
    status: "partial",
    isOverdue: false,
    
    notes: null,
    createdAt: "2026-02-08T14:30:00Z",
    
    // Payment history
    payments: [
      {
        id: 25,
        paymentNumber: "PAY-0025",
        date: "2026-02-10T10:00:00Z",
        amount: 60000,
        method: "cash",
        receivedBy: "admin"
      }
    ]
  }
}
```

---

### 7.8 Get Customer Statement

```http
GET /customers/:id/statement?from=2026-01-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  customer: {
    id: 10,
    name: "أحمد محمد",
    code: "CUS-0010"
  },
  
  period: {
    from: "2026-01-01",
    to: "2026-02-28"
  },
  
  openingBalance: 50000,       // 50.000 SAR at start of period
  
  transactions: [
    {
      date: "2026-01-15",
      type: "sale",
      reference: "SAL-0035",
      description: "مبيعات",
      debit: 75000,            // Customer owes more
      credit: 0,
      balance: 125000
    },
    {
      date: "2026-01-20",
      type: "payment",
      reference: "PAY-0020",
      description: "دفعة نقدية",
      debit: 0,
      credit: 100000,          // Customer paid
      balance: 25000
    },
    {
      date: "2026-02-08",
      type: "sale",
      reference: "SAL-0042",
      description: "مبيعات",
      debit: 100000,
      credit: 0,
      balance: 125000
    },
    {
      date: "2026-02-10",
      type: "payment",
      reference: "PAY-0025",
      description: "دفعة نقدية",
      debit: 0,
      credit: 60000,
      balance: 65000
    }
  ],
  
  totalSales: 175000,
  totalPayments: 160000,
  closingBalance: 65000        // Customer owes now
}
```

---

### 7.9 Get Overdue Debts Report

```http
GET /debts/overdue-report?branchId=1
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  report: {
    generatedAt: "2026-02-08T15:00:00Z",
    branchName: "الفرع الرئيسي"
  },
  
  summary: {
    totalOverdue: 5,
    totalAmount: 75000,
    avgDaysOverdue: 12
  },
  
  byAgeBucket: [
    {
      bucket: "1-7 days",
      count: 2,
      amount: 25000
    },
    {
      bucket: "8-14 days",
      count: 2,
      amount: 30000
    },
    {
      bucket: "15-30 days",
      count: 1,
      amount: 20000
    },
    {
      bucket: ">30 days",
      count: 0,
      amount: 0
    }
  ],
  
  debts: [
    {
      id: 12,
      customerName: "محمد علي",
      customerPhone: "0507654321",
      saleInvoice: "SAL-0030",
      originalAmount: 30000,
      remainingAmount: 25000,
      dueDate: "2026-02-01",
      daysOverdue: 7
    }
  ]
}
```

---

### 7.10 Create Manual Debt

```http
POST /debts
```

**Access**: 🔒 Admin only

#### Purpose
Create debt not linked to a sale (for opening balances, adjustments).

#### Request Body

```typescript
{
  customerId: number;
  branchId: number;
  amount: number;              // Minor units
  dueDate: string;             // ISO date
  reason: string;              // Required
}
```

#### Response (Success - 201)

```typescript
{
  debt: {
    id: 20,
    customerId: 10,
    customerName: "أحمد محمد",
    originalAmount: 50000,
    remainingAmount: 50000,
    dueDate: "2026-02-28",
    status: "unpaid"
  },
  message: "Debt created successfully",
  messageAr: "تم إنشاء الدين بنجاح"
}
```

#### Business Logic

```typescript
async createManualDebt(dto: CreateDebtDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: dto.customerId }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check credit limit
    if (customer.creditLimit) {
      const newBalance = customer.currentBalance + dto.amount;
      if (newBalance > customer.creditLimit) {
        throw new BadRequestException({
          code: 'CREDIT_LIMIT_EXCEEDED',
          message: 'Credit limit would be exceeded',
          messageAr: 'سيتم تجاوز الحد الائتماني',
          creditLimit: customer.creditLimit,
          currentBalance: customer.currentBalance,
          requestedAmount: dto.amount
        });
      }
    }

    // Create debt
    const debt = await tx.debt.create({
      data: {
        customerId: dto.customerId,
        branchId: dto.branchId,
        originalAmount: dto.amount,
        remainingAmount: dto.amount,
        dueDate: new Date(dto.dueDate),
        status: 'unpaid',
        notes: dto.reason
      }
    });

    // Update customer balance
    await tx.customer.update({
      where: { id: dto.customerId },
      data: {
        currentBalance: { increment: dto.amount }
      }
    });

    // Create journal entry
    await tx.journalEntry.create({
      data: {
        entryNumber: await generateJournalEntryNumber(tx),
        entryDate: new Date(),
        description: `Manual debt - ${dto.reason}`,
        descriptionAr: `دين يدوي - ${dto.reason}`,
        referenceType: 'ManualDebt',
        referenceId: debt.id,
        branchId: dto.branchId,
        status: 'posted'
      }
    });

    return debt;
  });
}
```

---

### 7.11 Cancel Debt

```http
POST /debts/:id/cancel
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  reason: string;
}
```

#### Business Logic

```typescript
async cancelDebt(debtId: number, reason: string, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findUnique({
      where: { id: debtId },
      include: { paymentAllocations: true }
    });

    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    if (debt.status === 'paid') {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'Cannot cancel a fully paid debt',
        messageAr: 'لا يمكن إلغاء دين مدفوع بالكامل'
      });
    }

    // Check if any payments were made
    if (debt.paymentAllocations.length > 0) {
      throw new BadRequestException({
        code: 'HAS_PAYMENTS',
        message: 'Cannot cancel debt with payments. Cancel payments first.',
        messageAr: 'لا يمكن إلغاء دين له مدفوعات. قم بإلغاء المدفوعات أولاً'
      });
    }

    // Update debt status
    await tx.debt.update({
      where: { id: debtId },
      data: {
        status: 'cancelled',
        notes: `${debt.notes || ''}\n[CANCELLED: ${reason}]`
      }
    });

    // Update customer balance
    await tx.customer.update({
      where: { id: debt.customerId },
      data: {
        currentBalance: { decrement: debt.remainingAmount }
      }
    });

    return { message: 'Debt cancelled successfully' };
  });
}
```

---

## Error Codes

| Code | HTTP | Message (EN) | Message (AR) |
|------|------|--------------|--------------|
| `CUSTOMER_NOT_FOUND` | 404 | Customer not found | العميل غير موجود |
| `DUPLICATE_PHONE` | 409 | Phone already exists | الرقم موجود مسبقاً |
| `CREDIT_LIMIT_EXCEEDED` | 400 | Credit limit exceeded | تم تجاوز الحد الائتماني |
| `HAS_OUTSTANDING_DEBT` | 400 | Customer has outstanding debt | العميل لديه ديون متبقية |
| `DEBT_NOT_FOUND` | 404 | Debt not found | الدين غير موجود |
| `ALREADY_PAID` | 400 | Debt is already paid | الدين مدفوع بالكامل |
| `HAS_PAYMENTS` | 400 | Debt has payments | الدين له مدفوعات |

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `POST /customers` | 📋 To Implement | customers.controller.ts |
| `GET /customers` | 📋 To Implement | customers.controller.ts |
| `GET /customers/:id` | 📋 To Implement | customers.controller.ts |
| `PUT /customers/:id` | 📋 To Implement | customers.controller.ts |
| `PUT /customers/:id/deactivate` | 📋 To Implement | customers.controller.ts |
| `GET /debts` | 📋 To Implement | debts.controller.ts |
| `GET /debts/:id` | 📋 To Implement | debts.controller.ts |
| `GET /customers/:id/statement` | 📋 To Implement | customers.controller.ts |
| `GET /debts/overdue-report` | 📋 To Implement | debts.controller.ts |
| `POST /debts` | 📋 To Implement | debts.controller.ts |
| `POST /debts/:id/cancel` | 📋 To Implement | debts.controller.ts |
