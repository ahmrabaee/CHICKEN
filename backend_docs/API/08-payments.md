# Module 08: Payments

> **Status**: 📋 To Implement  
> **Priority**: P0 - Critical  
> **PRD Reference**: Payment Collection & Supplier Payments (High)

---

## Overview

This module handles:
1. **Customer payments** - Collect payments from customers
2. **Debt allocation** - Apply payments to specific debts
3. **Supplier payments** - Pay amounts owed to suppliers
4. **Payment methods** - Cash, bank transfer, etc.
5. **Payment reversal** - Cancel erroneous payments

---

## Payment Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   CUSTOMER PAYMENT FLOW                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Customer: أحمد محمد                                         │
│  Current Balance: 100.000 SAR                                │
│                                                              │
│  Outstanding Debts:                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [x] SAL-0040  Due: Feb 10  Amount: 40.000 SAR         │  │
│  │ [x] SAL-0042  Due: Feb 15  Amount: 60.000 SAR         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Payment Amount: 50.000 SAR                                  │
│  Payment Method: Cash                                        │
│                                                              │
│  Auto-Allocation (FIFO by due date):                        │
│    SAL-0040: 40.000 SAR → PAID ✓                            │
│    SAL-0042: 10.000 SAR → Remaining: 50.000 SAR             │
│                                                              │
│  After Payment:                                              │
│    Customer Balance: 50.000 SAR                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Payment (Customer Payment)

```prisma
model Payment {
  id              Int       @id @default(autoincrement())
  paymentNumber   String    @unique @map("payment_number")
  customerId      Int       @map("customer_id")
  branchId        Int       @map("branch_id")
  receivedBy      Int       @map("received_by")
  
  paymentDate     DateTime  @default(now()) @map("payment_date")
  
  amount          Int                            // Minor units
  paymentMethod   String    @map("payment_method")  // 'cash', 'bank_transfer', 'check'
  
  referenceNumber String?   @map("reference_number")  // Check number, transfer ref
  notes           String?
  
  status          String    @default("completed")  // 'completed', 'cancelled'
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  customer        Customer  @relation(fields: [customerId], references: [id])
  branch          Branch    @relation(fields: [branchId], references: [id])
  receiver        User      @relation(fields: [receivedBy], references: [id])
  
  allocations     PaymentAllocation[]
  journalEntry    JournalEntry?
}
```

### PaymentAllocation

```prisma
model PaymentAllocation {
  id              Int       @id @default(autoincrement())
  paymentId       Int       @map("payment_id")
  debtId          Int       @map("debt_id")
  
  amount          Int                            // Amount applied to this debt
  
  createdAt       DateTime  @default(now())

  // Relations
  payment         Payment   @relation(fields: [paymentId], references: [id])
  debt            Debt      @relation(fields: [debtId], references: [id])
}
```

### SupplierPayment

```prisma
model SupplierPayment {
  id              Int       @id @default(autoincrement())
  paymentNumber   String    @unique @map("payment_number")
  supplierId      Int       @map("supplier_id")
  branchId        Int       @map("branch_id")
  paidBy          Int       @map("paid_by")
  
  paymentDate     DateTime  @default(now()) @map("payment_date")
  
  amount          Int                            // Minor units
  paymentMethod   String    @map("payment_method")  // 'cash', 'bank_transfer', 'check'
  
  referenceNumber String?   @map("reference_number")
  notes           String?
  
  status          String    @default("completed")
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  supplier        Supplier  @relation(fields: [supplierId], references: [id])
  branch          Branch    @relation(fields: [branchId], references: [id])
  payer           User      @relation(fields: [paidBy], references: [id])
  
  journalEntry    JournalEntry?
}
```

---

## API Endpoints

### 8.1 Create Customer Payment

```http
POST /payments
```

**Access**: 🔒 Admin, Cashier

#### Request Body

```typescript
{
  customerId: number;
  branchId: number;
  
  amount: number;                      // Minor units
  paymentMethod: 'cash' | 'bank_transfer' | 'check';
  referenceNumber?: string;            // For bank/check
  
  // Optional: specify which debts to pay
  allocations?: [
    {
      debtId: number;
      amount: number;
    }
  ];
  
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  payment: {
    id: 25,
    paymentNumber: "PAY-0025",
    
    customerId: 10,
    customerName: "أحمد محمد",
    
    branchName: "الفرع الرئيسي",
    receivedByName: "محمد الكاشير",
    
    paymentDate: "2026-02-10T10:00:00Z",
    
    amount: 50000,               // 50.000 SAR
    paymentMethod: "cash",
    referenceNumber: null,
    
    allocations: [
      {
        debtId: 14,
        saleInvoice: "SAL-0040",
        amountApplied: 40000,
        debtStatus: "paid",
        debtRemaining: 0
      },
      {
        debtId: 15,
        saleInvoice: "SAL-0042",
        amountApplied: 10000,
        debtStatus: "partial",
        debtRemaining: 50000
      }
    ],
    
    status: "completed"
  },
  
  customerBalanceAfter: 50000,   // 50.000 SAR remaining
  
  message: "Payment recorded successfully",
  messageAr: "تم تسجيل الدفعة بنجاح"
}
```

#### Business Logic

```typescript
async createPayment(dto: CreatePaymentDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate customer
    const customer = await tx.customer.findUnique({
      where: { id: dto.customerId }
    });
    
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    
    if (dto.amount > customer.currentBalance) {
      throw new BadRequestException({
        code: 'AMOUNT_EXCEEDS_BALANCE',
        message: 'Payment amount exceeds customer balance',
        messageAr: 'مبلغ الدفعة يتجاوز رصيد العميل',
        currentBalance: customer.currentBalance,
        paymentAmount: dto.amount
      });
    }
    
    // 2. Generate payment number
    const paymentNumber = await generatePaymentNumber(tx, 'PAY');
    
    // 3. Create payment record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        customerId: dto.customerId,
        branchId: dto.branchId,
        receivedBy: userId,
        paymentDate: new Date(),
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
        status: 'completed'
      }
    });
    
    // 4. Allocate payment to debts
    let remainingAmount = dto.amount;
    const allocations = [];
    
    if (dto.allocations && dto.allocations.length > 0) {
      // Manual allocation
      for (const alloc of dto.allocations) {
        const debt = await tx.debt.findUnique({
          where: { id: alloc.debtId }
        });
        
        if (!debt || debt.customerId !== dto.customerId) {
          throw new BadRequestException({
            code: 'INVALID_DEBT',
            message: `Debt ${alloc.debtId} not found or doesn't belong to customer`,
            messageAr: 'الدين غير موجود أو لا ينتمي للعميل'
          });
        }
        
        if (alloc.amount > debt.remainingAmount) {
          throw new BadRequestException({
            code: 'AMOUNT_EXCEEDS_DEBT',
            message: 'Allocation amount exceeds debt remaining',
            messageAr: 'مبلغ التخصيص يتجاوز المتبقي من الدين'
          });
        }
        
        if (alloc.amount > remainingAmount) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_PAYMENT',
            message: 'Total allocations exceed payment amount',
            messageAr: 'إجمالي التخصيصات يتجاوز مبلغ الدفعة'
          });
        }
        
        // Apply allocation
        const newRemaining = debt.remainingAmount - alloc.amount;
        const newStatus = newRemaining === 0 ? 'paid' : 'partial';
        
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            remainingAmount: newRemaining,
            status: newStatus
          }
        });
        
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            debtId: debt.id,
            amount: alloc.amount
          }
        });
        
        allocations.push({
          debtId: debt.id,
          amountApplied: alloc.amount,
          debtStatus: newStatus,
          debtRemaining: newRemaining
        });
        
        remainingAmount -= alloc.amount;
      }
    } else {
      // Auto-allocation (FIFO by due date)
      const debts = await tx.debt.findMany({
        where: {
          customerId: dto.customerId,
          remainingAmount: { gt: 0 },
          status: { in: ['unpaid', 'partial', 'overdue'] }
        },
        orderBy: { dueDate: 'asc' }
      });
      
      for (const debt of debts) {
        if (remainingAmount <= 0) break;
        
        const allocAmount = Math.min(debt.remainingAmount, remainingAmount);
        const newRemaining = debt.remainingAmount - allocAmount;
        const newStatus = newRemaining === 0 ? 'paid' : 'partial';
        
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            remainingAmount: newRemaining,
            status: newStatus
          }
        });
        
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            debtId: debt.id,
            amount: allocAmount
          }
        });
        
        allocations.push({
          debtId: debt.id,
          amountApplied: allocAmount,
          debtStatus: newStatus,
          debtRemaining: newRemaining
        });
        
        remainingAmount -= allocAmount;
      }
    }
    
    // 5. Update customer balance
    await tx.customer.update({
      where: { id: dto.customerId },
      data: {
        currentBalance: { decrement: dto.amount }
      }
    });
    
    // 6. Create journal entry
    await createPaymentJournalEntry(tx, {
      paymentId: payment.id,
      paymentNumber,
      branchId: dto.branchId,
      amount: dto.amount,
      customerId: dto.customerId,
      paymentMethod: dto.paymentMethod
    });
    
    return {
      payment: {
        ...payment,
        customerName: customer.name,
        receivedByName: 'TODO',  // Load user name
        allocations
      },
      customerBalanceAfter: customer.currentBalance - dto.amount
    };
  });
}
```

#### Accounting Entries

```
DR: Cash / Bank              50.000 SAR
CR: Accounts Receivable      50.000 SAR
```

---

### 8.2 List Customer Payments

```http
GET /payments?customerId=10&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin, Cashier

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `customerId` | number | Filter by customer |
| `branchId` | number | Filter by branch |
| `receivedBy` | number | Filter by cashier |
| `paymentMethod` | string | 'cash', 'bank_transfer', 'check' |
| `from` | date | Start date |
| `to` | date | End date |
| `status` | string | 'completed', 'cancelled' |

#### Response (Success - 200)

```typescript
{
  payments: [
    {
      id: 25,
      paymentNumber: "PAY-0025",
      customerId: 10,
      customerName: "أحمد محمد",
      branchName: "الفرع الرئيسي",
      receivedByName: "محمد الكاشير",
      
      paymentDate: "2026-02-10T10:00:00Z",
      
      amount: 50000,
      paymentMethod: "cash",
      
      allocationsCount: 2,
      status: "completed"
    }
  ],
  
  summary: {
    totalPayments: 30,
    totalAmount: 250000,
    byMethod: {
      cash: 200000,
      bank_transfer: 40000,
      check: 10000
    }
  },
  
  pagination: { ... }
}
```

---

### 8.3 Get Payment Details

```http
GET /payments/:id
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  payment: {
    id: 25,
    paymentNumber: "PAY-0025",
    
    customer: {
      id: 10,
      code: "CUS-0010",
      name: "أحمد محمد",
      phone: "0501234567"
    },
    
    branch: {
      id: 1,
      name: "الفرع الرئيسي"
    },
    
    receiver: {
      id: 3,
      name: "محمد الكاشير"
    },
    
    paymentDate: "2026-02-10T10:00:00Z",
    
    amount: 50000,
    paymentMethod: "cash",
    referenceNumber: null,
    
    allocations: [
      {
        id: 30,
        debt: {
          id: 14,
          saleId: 40,
          saleInvoice: "SAL-0040",
          originalAmount: 40000,
          remainingBefore: 40000
        },
        amount: 40000
      },
      {
        id: 31,
        debt: {
          id: 15,
          saleId: 42,
          saleInvoice: "SAL-0042",
          originalAmount: 60000,
          remainingBefore: 60000
        },
        amount: 10000
      }
    ],
    
    status: "completed",
    notes: null,
    createdAt: "2026-02-10T10:00:00Z"
  }
}
```

---

### 8.4 Cancel Customer Payment

```http
POST /payments/:id/cancel
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  reason: string;
}
```

#### Response (Success - 200)

```typescript
{
  payment: {
    id: 25,
    paymentNumber: "PAY-0025",
    status: "cancelled"
  },
  
  debtsRestored: [
    {
      debtId: 14,
      amountRestored: 40000,
      newStatus: "unpaid"
    },
    {
      debtId: 15,
      amountRestored: 10000,
      newStatus: "unpaid"
    }
  ],
  
  customerBalanceAfter: 100000,
  
  message: "Payment cancelled successfully",
  messageAr: "تم إلغاء الدفعة بنجاح"
}
```

#### Business Logic

```typescript
async cancelPayment(paymentId: number, reason: string, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: {
          include: { debt: true }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'cancelled') {
      throw new BadRequestException({
        code: 'ALREADY_CANCELLED',
        message: 'Payment is already cancelled',
        messageAr: 'الدفعة ملغاة مسبقاً'
      });
    }

    // 1. Restore debt amounts
    const debtsRestored = [];
    for (const alloc of payment.allocations) {
      const newRemaining = alloc.debt.remainingAmount + alloc.amount;
      const newStatus = newRemaining === alloc.debt.originalAmount ? 'unpaid' : 'partial';
      
      await tx.debt.update({
        where: { id: alloc.debtId },
        data: {
          remainingAmount: newRemaining,
          status: newStatus
        }
      });
      
      debtsRestored.push({
        debtId: alloc.debtId,
        amountRestored: alloc.amount,
        newStatus
      });
    }

    // 2. Update customer balance
    await tx.customer.update({
      where: { id: payment.customerId },
      data: {
        currentBalance: { increment: payment.amount }
      }
    });

    // 3. Update payment status
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'cancelled',
        notes: `${payment.notes || ''}\n[CANCELLED: ${reason}]`
      }
    });

    // 4. Create reversal journal entry
    await createPaymentCancellationJournalEntry(tx, payment, reason);

    const customer = await tx.customer.findUnique({
      where: { id: payment.customerId }
    });

    return {
      payment: {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        status: 'cancelled'
      },
      debtsRestored,
      customerBalanceAfter: customer!.currentBalance
    };
  });
}
```

---

### 8.5 Create Supplier Payment

```http
POST /supplier-payments
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  supplierId: number;
  branchId: number;
  
  amount: number;                      // Minor units
  paymentMethod: 'cash' | 'bank_transfer' | 'check';
  referenceNumber?: string;
  
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  payment: {
    id: 10,
    paymentNumber: "SPAY-0010",
    
    supplierId: 5,
    supplierName: "مزارع الراشد",
    
    branchName: "الفرع الرئيسي",
    paidByName: "admin",
    
    paymentDate: "2026-02-10T11:00:00Z",
    
    amount: 200000,              // 200.000 SAR
    paymentMethod: "bank_transfer",
    referenceNumber: "TRF-123456789",
    
    status: "completed"
  },
  
  supplierBalanceAfter: 300000,  // 300.000 SAR still owed
  
  message: "Supplier payment recorded successfully",
  messageAr: "تم تسجيل الدفعة للمورد بنجاح"
}
```

#### Business Logic

```typescript
async createSupplierPayment(dto: CreateSupplierPaymentDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate supplier
    const supplier = await tx.supplier.findUnique({
      where: { id: dto.supplierId }
    });
    
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    
    if (dto.amount > supplier.currentBalance) {
      throw new BadRequestException({
        code: 'AMOUNT_EXCEEDS_BALANCE',
        message: 'Payment amount exceeds supplier balance',
        messageAr: 'مبلغ الدفعة يتجاوز رصيد المورد',
        currentBalance: supplier.currentBalance,
        paymentAmount: dto.amount
      });
    }
    
    // 2. Generate payment number
    const paymentNumber = await generatePaymentNumber(tx, 'SPAY');
    
    // 3. Create payment record
    const payment = await tx.supplierPayment.create({
      data: {
        paymentNumber,
        supplierId: dto.supplierId,
        branchId: dto.branchId,
        paidBy: userId,
        paymentDate: new Date(),
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
        status: 'completed'
      }
    });
    
    // 4. Update supplier balance
    await tx.supplier.update({
      where: { id: dto.supplierId },
      data: {
        currentBalance: { decrement: dto.amount }
      }
    });
    
    // 5. Create journal entry
    await createSupplierPaymentJournalEntry(tx, {
      paymentId: payment.id,
      paymentNumber,
      branchId: dto.branchId,
      amount: dto.amount,
      supplierId: dto.supplierId,
      paymentMethod: dto.paymentMethod
    });
    
    return {
      payment: {
        ...payment,
        supplierName: supplier.name
      },
      supplierBalanceAfter: supplier.currentBalance - dto.amount
    };
  });
}
```

#### Accounting Entries

```
DR: Accounts Payable         200.000 SAR
CR: Cash / Bank              200.000 SAR
```

---

### 8.6 List Supplier Payments

```http
GET /supplier-payments?supplierId=5&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  payments: [
    {
      id: 10,
      paymentNumber: "SPAY-0010",
      supplierId: 5,
      supplierName: "مزارع الراشد",
      branchName: "الفرع الرئيسي",
      paidByName: "admin",
      
      paymentDate: "2026-02-10T11:00:00Z",
      
      amount: 200000,
      paymentMethod: "bank_transfer",
      
      status: "completed"
    }
  ],
  
  summary: {
    totalPayments: 15,
    totalAmount: 500000,
    byMethod: {
      cash: 100000,
      bank_transfer: 350000,
      check: 50000
    }
  },
  
  pagination: { ... }
}
```

---

### 8.7 Cancel Supplier Payment

```http
POST /supplier-payments/:id/cancel
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  reason: string;
}
```

---

### 8.8 Get Today's Collections

```http
GET /payments/today-summary?branchId=1
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  date: "2026-02-08",
  branchName: "الفرع الرئيسي",
  
  customerPayments: {
    count: 10,
    total: 150000,
    
    byMethod: {
      cash: { count: 8, amount: 120000 },
      bank_transfer: { count: 2, amount: 30000 }
    }
  },
  
  supplierPayments: {
    count: 2,
    total: 200000,
    
    byMethod: {
      cash: { count: 1, amount: 50000 },
      bank_transfer: { count: 1, amount: 150000 }
    }
  },
  
  netCashFlow: -50000    // Customer received - Supplier paid
}
```

---

## Error Codes

| Code | HTTP | Message (EN) | Message (AR) |
|------|------|--------------|--------------|
| `PAYMENT_NOT_FOUND` | 404 | Payment not found | الدفعة غير موجودة |
| `AMOUNT_EXCEEDS_BALANCE` | 400 | Amount exceeds balance | المبلغ يتجاوز الرصيد |
| `INVALID_DEBT` | 400 | Invalid debt allocation | تخصيص الدين غير صالح |
| `AMOUNT_EXCEEDS_DEBT` | 400 | Amount exceeds debt | المبلغ يتجاوز الدين |
| `INSUFFICIENT_PAYMENT` | 400 | Allocations exceed payment | التخصيصات تتجاوز الدفعة |
| `ALREADY_CANCELLED` | 400 | Already cancelled | ملغاة مسبقاً |

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `POST /payments` | 📋 To Implement | payments.controller.ts |
| `GET /payments` | 📋 To Implement | payments.controller.ts |
| `GET /payments/:id` | 📋 To Implement | payments.controller.ts |
| `POST /payments/:id/cancel` | 📋 To Implement | payments.controller.ts |
| `POST /supplier-payments` | 📋 To Implement | supplier-payments.controller.ts |
| `GET /supplier-payments` | 📋 To Implement | supplier-payments.controller.ts |
| `POST /supplier-payments/:id/cancel` | 📋 To Implement | supplier-payments.controller.ts |
| `GET /payments/today-summary` | 📋 To Implement | payments.controller.ts |
