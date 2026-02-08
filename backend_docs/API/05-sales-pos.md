# Module 05: Sales & Point of Sale (POS)

> **Status**: 📋 To Implement  
> **Priority**: P0 - Critical  
> **PRD Reference**: Sales & POS (High), Profit Calculation

---

## Overview

This module handles:
1. **Point of Sale** - Fast checkout interface
2. **FIFO cost allocation** - Calculate true cost per sale
3. **Profit calculation** - Real-time profit per transaction
4. **Payment types** - Cash, credit (creates debt), partial
5. **Invoice generation** - Print-ready sale receipts
6. **Multi-item checkout** - Cart-based transactions

---

## Sale Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        POS CHECKOUT                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SCAN/SELECT ITEMS                                        │
│     ┌─────────────────────────────────────────────┐          │
│     │ Item: دجاج كامل (Whole Chicken)             │          │
│     │ Qty:  5 kg  @ 8.000 SAR/kg                 │          │
│     │ Subtotal: 40.000 SAR                       │          │
│     └─────────────────────────────────────────────┘          │
│                                                              │
│  2. FIFO COST CALCULATION (Hidden from cashier)              │
│     LOT-001: 3 kg @ 5.000 = 15.000 SAR                      │
│     LOT-002: 2 kg @ 5.500 = 11.000 SAR                      │
│     Total Cost:             26.000 SAR                       │
│                                                              │
│  3. PAYMENT                                                  │
│     ○ Cash (نقداً)                                           │
│     ○ Credit (آجل) → Creates debt                           │
│     ○ Partial (جزئي) → Pay now + Debt                       │
│                                                              │
│  4. RESULT                                                   │
│     Revenue:  40.000 SAR                                     │
│     COGS:     26.000 SAR                                     │
│     Profit:   14.000 SAR (35%)                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Sale

```prisma
model Sale {
  id              Int       @id @default(autoincrement())
  invoiceNumber   String    @unique @map("invoice_number")
  branchId        Int       @map("branch_id")
  customerId      Int?      @map("customer_id")
  cashierId       Int       @map("cashier_id")
  
  saleDate        DateTime  @default(now()) @map("sale_date")
  
  // Amounts (minor units - fils)
  subtotal        Int       // Sum of line totals
  discountAmount  Int       @default(0) @map("discount_amount")
  taxAmount       Int       @default(0) @map("tax_amount")
  totalAmount     Int       @map("total_amount")   // Final invoice total
  
  // Cost & Profit
  totalCost       Int       @map("total_cost")     // FIFO cost (hidden)
  totalProfit     Int       @map("total_profit")   // Revenue - Cost
  profitMargin    Decimal   @map("profit_margin")  // Profit / Revenue * 100
  
  // Payment
  paymentMethod   String    @map("payment_method") // 'cash', 'credit', 'partial'
  amountPaid      Int       @map("amount_paid")
  amountDue       Int       @map("amount_due")     // Creates debt if > 0
  
  status          String    @default("completed")  // 'completed', 'returned', 'partial_return'
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  branch          Branch    @relation(fields: [branchId], references: [id])
  customer        Customer? @relation(fields: [customerId], references: [id])
  cashier         User      @relation(fields: [cashierId], references: [id])
  
  saleLines       SaleLine[]
  debts           Debt[]
  returns         Return[]
  journalEntry    JournalEntry?
}
```

### SaleLine

```prisma
model SaleLine {
  id              Int       @id @default(autoincrement())
  saleId          Int       @map("sale_id")
  itemId          Int       @map("item_id")
  
  quantity        Decimal
  unitPrice       Int       @map("unit_price")     // Selling price
  discount        Int       @default(0)
  lineTotal       Int       @map("line_total")     // (quantity * unitPrice) - discount
  
  // Cost (FIFO allocated)
  costAmount      Int       @map("cost_amount")    // Total FIFO cost
  profitAmount    Int       @map("profit_amount")  // lineTotal - costAmount
  
  createdAt       DateTime  @default(now())

  // Relations
  sale            Sale      @relation(fields: [saleId], references: [id])
  item            Item      @relation(fields: [itemId], references: [id])
  
  costAllocations SaleLineCostAllocation[]
}
```

### SaleLineCostAllocation

```prisma
model SaleLineCostAllocation {
  id              Int       @id @default(autoincrement())
  saleLineId      Int       @map("sale_line_id")
  lotId           Int       @map("lot_id")
  
  quantity        Decimal
  costPerUnit     Int       @map("cost_per_unit")
  totalCost       Int       @map("total_cost")
  
  createdAt       DateTime  @default(now())

  // Relations
  saleLine        SaleLine      @relation(fields: [saleLineId], references: [id])
  lot             InventoryLot  @relation(fields: [lotId], references: [id])
}
```

---

## API Endpoints

### 5.1 Create Sale (POS Checkout)

```http
POST /sales
```

**Access**: 🔒 Admin, Cashier

#### Request Body

```typescript
{
  branchId: number;
  customerId?: number;           // Optional for walk-in
  
  items: [
    {
      itemId: number;
      quantity: number;          // In item's unit (kg, piece)
      unitPrice: number;         // Minor units (override allowed)
      discount?: number;         // Line discount (minor units)
    }
  ];
  
  discountAmount?: number;       // Invoice-level discount
  taxAmount?: number;            // VAT if applicable
  
  paymentMethod: 'cash' | 'credit' | 'partial';
  amountPaid?: number;           // Required for partial
  
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  sale: {
    id: 42,
    invoiceNumber: "SAL-0042",
    branchId: 1,
    branchName: "الفرع الرئيسي",
    customerId: 10,
    customerName: "أحمد محمد",
    cashierId: 3,
    cashierName: "محمد الكاشير",
    
    saleDate: "2026-02-08T14:30:00Z",
    
    lines: [
      {
        id: 100,
        itemId: 10,
        itemCode: "CHIC-001",
        itemName: "دجاج كامل",
        quantity: 5.000,
        unitPrice: 8000,         // 8.000 SAR
        discount: 0,
        lineTotal: 40000,        // 40.000 SAR
        costAmount: 26000,       // Hidden from cashier response
        profitAmount: 14000      // Hidden from cashier response
      }
    ],
    
    subtotal: 40000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 40000,
    
    // Hidden from cashier
    totalCost: 26000,
    totalProfit: 14000,
    profitMargin: 35.00,
    
    paymentMethod: "cash",
    amountPaid: 40000,
    amountDue: 0,
    
    status: "completed",
    notes: null
  },
  
  // Only for partial/credit payments
  debt?: {
    id: 15,
    amount: 20000,              // Amount owed
    dueDate: "2026-02-15"
  },
  
  message: "Sale completed successfully",
  messageAr: "تمت عملية البيع بنجاح"
}
```

#### Business Logic

```typescript
async createSale(dto: CreateSaleDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate and prepare items
    const items = await this.validateAndPrepareSaleItems(tx, dto);
    
    // 2. Check stock availability
    const availability = await this.checkStockAvailability(
      tx, 
      dto.branchId, 
      dto.items
    );
    
    if (!availability.available) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient stock for one or more items',
        messageAr: 'المخزون غير كافٍ لواحد أو أكثر من المنتجات',
        items: availability.shortages
      });
    }
    
    // 3. Calculate FIFO costs for each item
    const saleLines: SaleLineData[] = [];
    let totalCost = 0;
    let subtotal = 0;
    
    for (const item of dto.items) {
      // Get available lots (FIFO order)
      const lots = await tx.inventoryLot.findMany({
        where: {
          itemId: item.itemId,
          branchId: dto.branchId,
          currentQuantity: { gt: 0 },
          status: 'available',
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: new Date() } }
          ]
        },
        orderBy: { receivedAt: 'asc' }
      });
      
      // Calculate FIFO allocation
      const { allocations, totalCost: lineCost } = calculateFIFOCost(
        lots, 
        item.quantity
      );
      
      const lineDiscount = item.discount || 0;
      const lineTotal = (item.quantity * item.unitPrice) - lineDiscount;
      const lineProfit = lineTotal - lineCost;
      
      saleLines.push({
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: lineDiscount,
        lineTotal,
        costAmount: lineCost,
        profitAmount: lineProfit,
        allocations
      });
      
      totalCost += lineCost;
      subtotal += lineTotal;
    }
    
    // 4. Calculate totals
    const discountAmount = dto.discountAmount || 0;
    const taxAmount = dto.taxAmount || 0;
    const totalAmount = subtotal - discountAmount + taxAmount;
    const totalProfit = totalAmount - totalCost;
    const profitMargin = totalAmount > 0 
      ? (totalProfit / totalAmount) * 100 
      : 0;
    
    // 5. Handle payment
    let amountPaid = totalAmount;
    let amountDue = 0;
    
    if (dto.paymentMethod === 'credit') {
      // Customer required for credit sales
      if (!dto.customerId) {
        throw new BadRequestException({
          code: 'CUSTOMER_REQUIRED',
          message: 'Customer is required for credit sales',
          messageAr: 'العميل مطلوب للبيع الآجل'
        });
      }
      amountPaid = 0;
      amountDue = totalAmount;
    } else if (dto.paymentMethod === 'partial') {
      if (!dto.customerId) {
        throw new BadRequestException({
          code: 'CUSTOMER_REQUIRED',
          message: 'Customer is required for partial payment',
          messageAr: 'العميل مطلوب للدفع الجزئي'
        });
      }
      if (!dto.amountPaid || dto.amountPaid >= totalAmount) {
        throw new BadRequestException({
          code: 'INVALID_PAYMENT',
          message: 'Partial payment must be less than total',
          messageAr: 'الدفع الجزئي يجب أن يكون أقل من المجموع'
        });
      }
      amountPaid = dto.amountPaid;
      amountDue = totalAmount - amountPaid;
    }
    
    // 6. Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(tx, 'SAL');
    
    // 7. Create sale record
    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        branchId: dto.branchId,
        customerId: dto.customerId,
        cashierId: userId,
        saleDate: new Date(),
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        totalCost,
        totalProfit,
        profitMargin,
        paymentMethod: dto.paymentMethod,
        amountPaid,
        amountDue,
        status: 'completed',
        notes: dto.notes
      }
    });
    
    // 8. Create sale lines and allocations
    for (const line of saleLines) {
      const saleLine = await tx.saleLine.create({
        data: {
          saleId: sale.id,
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          lineTotal: line.lineTotal,
          costAmount: line.costAmount,
          profitAmount: line.profitAmount
        }
      });
      
      // Create cost allocations and deduct inventory
      for (const alloc of line.allocations) {
        await tx.saleLineCostAllocation.create({
          data: {
            saleLineId: saleLine.id,
            lotId: alloc.lotId,
            quantity: alloc.quantity,
            costPerUnit: alloc.costPerUnit,
            totalCost: alloc.cost
          }
        });
        
        // Deduct from lot
        await tx.inventoryLot.update({
          where: { id: alloc.lotId },
          data: {
            currentQuantity: { decrement: alloc.quantity },
            status: alloc.quantity >= (await tx.inventoryLot.findUnique({ where: { id: alloc.lotId } }))!.currentQuantity.toNumber()
              ? 'depleted'
              : 'available'
          }
        });
        
        // Create stock movement
        await tx.stockMovement.create({
          data: {
            lotId: alloc.lotId,
            movementType: 'sale',
            quantity: -alloc.quantity,
            referenceType: 'Sale',
            referenceId: sale.id,
            userId,
            branchId: dto.branchId
          }
        });
      }
      
      // Update inventory aggregate
      await updateInventoryTotal(tx, line.itemId, dto.branchId, -line.quantity);
    }
    
    // 9. Create debt if credit/partial payment
    let debt = null;
    if (amountDue > 0 && dto.customerId) {
      const defaultDueDays = await getSettingNumber('sales.default_credit_days') || 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + defaultDueDays);
      
      debt = await tx.debt.create({
        data: {
          customerId: dto.customerId,
          saleId: sale.id,
          branchId: dto.branchId,
          originalAmount: amountDue,
          remainingAmount: amountDue,
          dueDate,
          status: 'unpaid',
          notes: `Auto-generated from sale ${invoiceNumber}`
        }
      });
      
      // Update customer balance
      await tx.customer.update({
        where: { id: dto.customerId },
        data: {
          currentBalance: { increment: amountDue }
        }
      });
    }
    
    // 10. Create journal entry
    await createSaleJournalEntry(tx, {
      saleId: sale.id,
      invoiceNumber,
      branchId: dto.branchId,
      totalAmount,
      amountPaid,
      amountDue,
      totalCost,
      customerId: dto.customerId
    });
    
    // 11. Return response
    return {
      sale: await this.getSaleById(sale.id, userId),
      debt: debt ? {
        id: debt.id,
        amount: debt.originalAmount,
        dueDate: debt.dueDate.toISOString().split('T')[0]
      } : undefined
    };
  });
}
```

#### Accounting Entries

**Cash Sale:**
```
DR: Cash                        40.000 SAR (total received)
CR: Sales Revenue              40.000 SAR

DR: Cost of Goods Sold (COGS)  26.000 SAR (FIFO cost)
CR: Inventory                  26.000 SAR
```

**Credit Sale:**
```
DR: Accounts Receivable        40.000 SAR (debt created)
CR: Sales Revenue              40.000 SAR

DR: Cost of Goods Sold (COGS)  26.000 SAR
CR: Inventory                  26.000 SAR
```

**Partial Payment:**
```
DR: Cash                       20.000 SAR (amount paid)
DR: Accounts Receivable        20.000 SAR (debt)
CR: Sales Revenue              40.000 SAR

DR: Cost of Goods Sold (COGS)  26.000 SAR
CR: Inventory                  26.000 SAR
```

---

### 5.2 Get Sale Details

```http
GET /sales/:id
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  sale: {
    id: 42,
    invoiceNumber: "SAL-0042",
    branchId: 1,
    branchName: "الفرع الرئيسي",
    
    customer: {
      id: 10,
      name: "أحمد محمد",
      phone: "0501234567"
    },
    
    cashier: {
      id: 3,
      name: "محمد الكاشير"
    },
    
    saleDate: "2026-02-08T14:30:00Z",
    
    lines: [
      {
        id: 100,
        item: {
          id: 10,
          code: "CHIC-001",
          name: "دجاج كامل",
          nameEn: "Whole Chicken",
          unitOfMeasure: "kg"
        },
        quantity: 5.000,
        unitPrice: 8000,
        discount: 0,
        lineTotal: 40000,
        
        // Admin only
        costAmount: 26000,
        profitAmount: 14000,
        allocations: [
          {
            lotNumber: "LOT-20260206-001",
            quantity: 3.000,
            costPerUnit: 5000
          },
          {
            lotNumber: "LOT-20260208-001",
            quantity: 2.000,
            costPerUnit: 5500
          }
        ]
      }
    ],
    
    subtotal: 40000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 40000,
    
    // Admin only
    totalCost: 26000,
    totalProfit: 14000,
    profitMargin: 35.00,
    
    paymentMethod: "cash",
    amountPaid: 40000,
    amountDue: 0,
    
    status: "completed",
    notes: null,
    
    createdAt: "2026-02-08T14:30:00Z"
  }
}
```

---

### 5.3 List Sales

```http
GET /sales?branchId=1&from=2026-02-01&to=2026-02-28&cashierId=3&customerId=10
```

**Access**: 🔒 Admin, Cashier (own sales only)

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `branchId` | number | Filter by branch |
| `from` | date | Start date |
| `to` | date | End date |
| `customerId` | number | Filter by customer |
| `cashierId` | number | Filter by cashier |
| `paymentMethod` | string | 'cash', 'credit', 'partial' |
| `status` | string | 'completed', 'returned', 'partial_return' |

#### Response (Success - 200)

```typescript
{
  sales: [
    {
      id: 42,
      invoiceNumber: "SAL-0042",
      saleDate: "2026-02-08T14:30:00Z",
      customerName: "أحمد محمد",
      cashierName: "محمد الكاشير",
      branchName: "الفرع الرئيسي",
      
      totalAmount: 40000,
      totalCost: 26000,        // Admin only
      totalProfit: 14000,      // Admin only
      
      paymentMethod: "cash",
      amountPaid: 40000,
      amountDue: 0,
      
      status: "completed",
      itemCount: 1
    }
  ],
  
  summary: {                    // Admin only
    totalSales: 150,
    totalRevenue: 5000000,      // 5,000 SAR
    totalCost: 3250000,
    totalProfit: 1750000,
    avgProfitMargin: 35.00
  },
  
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 150,
    totalPages: 8
  }
}
```

---

### 5.4 Get Today's Sales Summary

```http
GET /sales/today-summary?branchId=1
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  date: "2026-02-08",
  branchName: "الفرع الرئيسي",
  
  totalSales: 25,
  totalRevenue: 125000,        // 125.000 SAR
  totalCost: 81250,            // Admin only
  totalProfit: 43750,          // Admin only
  profitMargin: 35.00,         // Admin only
  
  byPaymentMethod: {
    cash: {
      count: 20,
      amount: 100000
    },
    credit: {
      count: 3,
      amount: 15000
    },
    partial: {
      count: 2,
      amount: 10000,
      collected: 5000
    }
  },
  
  topItems: [
    {
      itemId: 10,
      itemName: "دجاج كامل",
      quantitySold: 50.000,
      revenue: 50000,
      profit: 17500             // Admin only
    }
  ],
  
  hourlyBreakdown: [            // Admin only
    {
      hour: 8,
      salesCount: 2,
      revenue: 8000
    },
    {
      hour: 9,
      salesCount: 5,
      revenue: 25000
    }
    // ... continues for each hour
  ]
}
```

---

### 5.5 Cancel Sale

```http
POST /sales/:id/cancel
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  reason: string;               // Required
}
```

#### Response (Success - 200)

```typescript
{
  sale: {
    id: 42,
    invoiceNumber: "SAL-0042",
    status: "cancelled"
  },
  
  reversals: {
    inventoryRestored: [
      {
        itemId: 10,
        itemName: "دجاج كامل",
        quantity: 5.000
      }
    ],
    debtCancelled: {
      id: 15,
      amount: 20000
    }
  },
  
  message: "Sale cancelled successfully",
  messageAr: "تم إلغاء البيع بنجاح"
}
```

#### Business Logic

```typescript
async cancelSale(saleId: number, reason: string, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        saleLines: {
          include: {
            costAllocations: true
          }
        },
        debts: true
      }
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.status === 'cancelled') {
      throw new BadRequestException({
        code: 'ALREADY_CANCELLED',
        message: 'Sale is already cancelled',
        messageAr: 'تم إلغاء هذه الفاتورة مسبقاً'
      });
    }

    // 1. Restore inventory to original lots
    for (const line of sale.saleLines) {
      for (const alloc of line.costAllocations) {
        await tx.inventoryLot.update({
          where: { id: alloc.lotId },
          data: {
            currentQuantity: { increment: alloc.quantity },
            status: 'available'
          }
        });

        // Create reversal stock movement
        await tx.stockMovement.create({
          data: {
            lotId: alloc.lotId,
            movementType: 'return',
            quantity: alloc.quantity.toNumber(),
            referenceType: 'SaleCancellation',
            referenceId: sale.id,
            reason,
            userId,
            branchId: sale.branchId
          }
        });
      }

      // Update inventory aggregate
      await updateInventoryTotal(tx, line.itemId, sale.branchId, line.quantity.toNumber());
    }

    // 2. Cancel any debts
    for (const debt of sale.debts) {
      await tx.debt.update({
        where: { id: debt.id },
        data: { status: 'cancelled' }
      });

      // Reduce customer balance
      if (sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            currentBalance: { decrement: debt.remainingAmount }
          }
        });
      }
    }

    // 3. Update sale status
    await tx.sale.update({
      where: { id: saleId },
      data: {
        status: 'cancelled',
        notes: `${sale.notes || ''}\n[CANCELLED: ${reason}]`
      }
    });

    // 4. Create reversal journal entry
    await createSaleCancellationJournalEntry(tx, sale, reason);

    return {
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        status: 'cancelled'
      },
      reversals: {
        inventoryRestored: sale.saleLines.map(line => ({
          itemId: line.itemId,
          itemName: '', // Load from item
          quantity: line.quantity.toNumber()
        })),
        debtCancelled: sale.debts.length > 0 ? {
          id: sale.debts[0].id,
          amount: sale.debts[0].originalAmount
        } : null
      }
    };
  });
}
```

---

### 5.6 Apply Discount

```http
POST /sales/:id/discount
```

**Access**: 🔒 Admin only

#### Purpose
Apply additional discount to an existing sale (before day close).

#### Request Body

```typescript
{
  discountAmount: number;       // Additional discount (minor units)
  reason: string;
}
```

#### Response (Success - 200)

```typescript
{
  sale: {
    id: 42,
    originalTotal: 40000,
    newDiscountAmount: 5000,
    newTotalAmount: 35000,
    
    // If had credit
    debtAdjusted: {
      originalAmount: 40000,
      newAmount: 35000
    }
  },
  message: "Discount applied successfully",
  messageAr: "تم تطبيق الخصم بنجاح"
}
```

---

### 5.7 Print Invoice

```http
GET /sales/:id/invoice
```

**Access**: 🔒 Admin, Cashier

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | 'json', 'html', 'pdf' (default: json) |
| `language` | string | 'ar', 'en', 'both' (default: ar) |

#### Response (Success - 200 for JSON)

```typescript
{
  invoice: {
    // Header
    storeName: "مطعم الدجاج الذهبي",
    storeNameEn: "Golden Chicken Restaurant",
    branchName: "الفرع الرئيسي",
    address: "شارع الملك فهد، الرياض",
    phone: "0112345678",
    vatNumber: "300123456789003",
    
    // Invoice details
    invoiceNumber: "SAL-0042",
    date: "2026-02-08",
    time: "14:30",
    cashierName: "محمد",
    
    // Customer (if any)
    customer: {
      name: "أحمد محمد",
      phone: "0501234567"
    },
    
    // Items
    items: [
      {
        name: "دجاج كامل",
        nameEn: "Whole Chicken",
        quantity: "5.000 كجم",
        unitPrice: "8.000",
        total: "40.000"
      }
    ],
    
    // Totals
    subtotal: "40.000 ر.س",
    discount: "0.000 ر.س",
    tax: "0.000 ر.س",
    total: "40.000 ر.س",
    
    // Payment
    paymentMethod: "نقداً",
    amountPaid: "40.000 ر.س",
    amountDue: "0.000 ر.س",
    
    // Footer
    footer: "شكراً لزيارتكم",
    footerEn: "Thank you for your visit"
  }
}
```

---

## Error Codes

| Code | HTTP | Message (EN) | Message (AR) |
|------|------|--------------|--------------|
| `INSUFFICIENT_STOCK` | 400 | Insufficient stock | المخزون غير كافٍ |
| `CUSTOMER_REQUIRED` | 400 | Customer required for credit | العميل مطلوب للبيع الآجل |
| `INVALID_PAYMENT` | 400 | Invalid payment amount | مبلغ الدفع غير صالح |
| `SALE_NOT_FOUND` | 404 | Sale not found | الفاتورة غير موجودة |
| `ALREADY_CANCELLED` | 400 | Sale already cancelled | تم إلغاء الفاتورة مسبقاً |
| `ITEM_NOT_FOUND` | 400 | Item not found | المنتج غير موجود |
| `PRICE_MISMATCH` | 400 | Price does not match | السعر غير مطابق |
| `EXPIRED_INVENTORY` | 400 | Only expired inventory available | المخزون المتاح منتهي الصلاحية فقط |

---

## Helper Functions

### Calculate FIFO Cost

```typescript
interface CostAllocation {
  lotId: number;
  lotNumber: string;
  quantity: number;
  costPerUnit: number;
  cost: number;
}

function calculateFIFOCost(
  lots: InventoryLot[], 
  quantity: number
): { allocations: CostAllocation[], totalCost: number } {
  const allocations: CostAllocation[] = [];
  let remaining = quantity;
  let totalCost = 0;

  // Lots must be sorted by receivedAt ascending (oldest first)
  for (const lot of lots) {
    if (remaining <= 0) break;
    
    const available = lot.currentQuantity.toNumber();
    const allocQty = Math.min(available, remaining);
    const cost = allocQty * lot.costPerUnit;
    
    allocations.push({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      quantity: allocQty,
      costPerUnit: lot.costPerUnit,
      cost
    });
    
    totalCost += cost;
    remaining -= allocQty;
  }

  if (remaining > 0) {
    throw new InsufficientStockException();
  }

  return { allocations, totalCost };
}
```

### Generate Invoice Number

```typescript
async function generateInvoiceNumber(
  tx: PrismaTransaction, 
  prefix: string
): Promise<string> {
  const lastSale = await tx.sale.findFirst({
    orderBy: { id: 'desc' },
    select: { invoiceNumber: true }
  });

  let sequence = 1;
  if (lastSale?.invoiceNumber) {
    const match = lastSale.invoiceNumber.match(/\d+$/);
    if (match) {
      sequence = parseInt(match[0]) + 1;
    }
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}
// Result: SAL-0001, SAL-0002, etc.
```

### Create Sale Journal Entry

```typescript
async function createSaleJournalEntry(
  tx: PrismaTransaction,
  data: {
    saleId: number;
    invoiceNumber: string;
    branchId: number;
    totalAmount: number;
    amountPaid: number;
    amountDue: number;
    totalCost: number;
    customerId?: number;
  }
) {
  const journal = await tx.journalEntry.create({
    data: {
      entryNumber: await generateJournalEntryNumber(tx),
      entryDate: new Date(),
      description: `Sale ${data.invoiceNumber}`,
      descriptionAr: `بيع ${data.invoiceNumber}`,
      referenceType: 'Sale',
      referenceId: data.saleId,
      branchId: data.branchId,
      status: 'posted',
      createdBy: /* userId */
    }
  });

  const entries: JournalLine[] = [];

  // Debit: Cash or Receivable
  if (data.amountPaid > 0) {
    entries.push({
      journalEntryId: journal.id,
      accountId: CHART_OF_ACCOUNTS.CASH,
      debitAmount: data.amountPaid,
      creditAmount: 0,
      description: 'Cash received'
    });
  }

  if (data.amountDue > 0) {
    entries.push({
      journalEntryId: journal.id,
      accountId: CHART_OF_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      debitAmount: data.amountDue,
      creditAmount: 0,
      description: `Customer debt - ${data.customerId}`
    });
  }

  // Credit: Sales Revenue
  entries.push({
    journalEntryId: journal.id,
    accountId: CHART_OF_ACCOUNTS.SALES_REVENUE,
    debitAmount: 0,
    creditAmount: data.totalAmount,
    description: 'Sales revenue'
  });

  // Debit: COGS
  entries.push({
    journalEntryId: journal.id,
    accountId: CHART_OF_ACCOUNTS.COST_OF_GOODS_SOLD,
    debitAmount: data.totalCost,
    creditAmount: 0,
    description: 'Cost of goods sold'
  });

  // Credit: Inventory
  entries.push({
    journalEntryId: journal.id,
    accountId: CHART_OF_ACCOUNTS.INVENTORY,
    debitAmount: 0,
    creditAmount: data.totalCost,
    description: 'Inventory reduction'
  });

  await tx.journalLine.createMany({ data: entries });
}
```

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `POST /sales` | 📋 To Implement | sales.controller.ts |
| `GET /sales/:id` | 📋 To Implement | sales.controller.ts |
| `GET /sales` | 📋 To Implement | sales.controller.ts |
| `GET /sales/today-summary` | 📋 To Implement | sales.controller.ts |
| `POST /sales/:id/cancel` | 📋 To Implement | sales.controller.ts |
| `POST /sales/:id/discount` | 📋 To Implement | sales.controller.ts |
| `GET /sales/:id/invoice` | 📋 To Implement | sales.controller.ts |
