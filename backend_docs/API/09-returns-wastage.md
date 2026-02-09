![alt text](image.png)# Module 09: Returns & Wastage

> **Status**: 📋 To Implement  
> **Priority**: P1 - High  
> **PRD Reference**: Returns Processing & Wastage Recording

---

## Overview

This module handles:
1. **Customer returns** - Items returned by customers
2. **Purchase returns** - Items returned to suppliers
3. **Wastage recording** - Expired, damaged, or spoiled inventory
4. **Inventory restoration** - Return items to stock
5. **Refunds/Credits** - Customer credit or cash refund

---

## Return Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   CUSTOMER RETURN FLOW                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Original Sale: SAL-0042                                     │
│  Customer: أحمد محمد                                         │
│                                                              │
│  Items Returning:                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Item: دجاج كامل    Qty: 2 kg                          │  │
│  │ Original Price: 8.000 SAR/kg                          │  │
│  │ Return Amount: 16.000 SAR                             │  │
│  │ FIFO Cost: 10.000 SAR (from original allocation)      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Return Type:                                                │
│    ○ Good condition → Restock (create new lot)              │
│    ○ Bad condition → Wastage (expense)                      │
│                                                              │
│  Refund Type:                                                │
│    ○ Cash refund                                            │
│    ○ Credit to balance (reduce debt)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Return (Customer Return)

```prisma
model Return {
  id              Int       @id @default(autoincrement())
  returnNumber    String    @unique @map("return_number")
  saleId          Int       @map("sale_id")
  customerId      Int?      @map("customer_id")
  branchId        Int       @map("branch_id")
  processedBy     Int       @map("processed_by")
  
  returnDate      DateTime  @default(now()) @map("return_date")
  
  totalAmount     Int       @map("total_amount")   // Refund amount
  totalCost       Int       @map("total_cost")     // FIFO cost of returned items
  
  refundMethod    String    @map("refund_method")  // 'cash', 'credit'
  
  status          String    @default("completed")
  reason          String
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  sale            Sale      @relation(fields: [saleId], references: [id])
  customer        Customer? @relation(fields: [customerId], references: [id])
  branch          Branch    @relation(fields: [branchId], references: [id])
  processor       User      @relation(fields: [processedBy], references: [id])
  
  returnLines     ReturnLine[]
  journalEntry    JournalEntry?
}
```

### ReturnLine

```prisma
model ReturnLine {
  id              Int       @id @default(autoincrement())
  returnId        Int       @map("return_id")
  saleLineId      Int       @map("sale_line_id")
  itemId          Int       @map("item_id")
  
  quantity        Decimal
  unitPrice       Int       @map("unit_price")
  lineAmount      Int       @map("line_amount")
  costAmount      Int       @map("cost_amount")    // Original FIFO cost
  
  condition       String    // 'good', 'damaged', 'expired'
  restockLotId    Int?      @map("restock_lot_id") // If restocked
  
  createdAt       DateTime  @default(now())

  // Relations
  return          Return    @relation(fields: [returnId], references: [id])
  saleLine        SaleLine  @relation(fields: [saleLineId], references: [id])
  item            Item      @relation(fields: [itemId], references: [id])
  restockLot      InventoryLot? @relation(fields: [restockLotId], references: [id])
}
```

### Wastage

```prisma
model Wastage {
  id              Int       @id @default(autoincrement())
  wastageNumber   String    @unique @map("wastage_number")
  lotId           Int       @map("lot_id")
  itemId          Int       @map("item_id")
  branchId        Int       @map("branch_id")
  recordedBy      Int       @map("recorded_by")
  
  wastageDate     DateTime  @default(now()) @map("wastage_date")
  
  quantity        Decimal
  costPerUnit     Int       @map("cost_per_unit")
  totalCost       Int       @map("total_cost")
  
  wastageType     String    @map("wastage_type")  // 'expired', 'damaged', 'spoiled', 'theft'
  reason          String
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  lot             InventoryLot @relation(fields: [lotId], references: [id])
  item            Item         @relation(fields: [itemId], references: [id])
  branch          Branch       @relation(fields: [branchId], references: [id])
  recorder        User         @relation(fields: [recordedBy], references: [id])
  
  journalEntry    JournalEntry?
}
```

---

## API Endpoints

### 9.1 Create Customer Return

```http
POST /returns
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  saleId: number;              // Original sale
  branchId: number;
  
  items: [
    {
      saleLineId: number;
      quantity: number;
      condition: 'good' | 'damaged' | 'expired';
      restockToInventory: boolean;  // Only for 'good' condition
    }
  ];
  
  refundMethod: 'cash' | 'credit';
  
  reason: string;
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  return: {
    id: 5,
    returnNumber: "RET-0005",
    
    saleId: 42,
    saleInvoice: "SAL-0042",
    customerId: 10,
    customerName: "أحمد محمد",
    
    branchName: "الفرع الرئيسي",
    processedByName: "admin",
    
    returnDate: "2026-02-10T15:00:00Z",
    
    lines: [
      {
        id: 10,
        itemId: 10,
        itemName: "دجاج كامل",
        quantity: 2.000,
        unitPrice: 8000,
        lineAmount: 16000,
        costAmount: 10000,
        condition: "good",
        restockLot: {
          id: 150,
          lotNumber: "RET-20260210-001"
        }
      }
    ],
    
    totalAmount: 16000,        // 16.000 SAR refunded
    totalCost: 10000,          // 10.000 SAR cost recovered
    
    refundMethod: "cash",
    status: "completed",
    reason: "Customer changed mind"
  },
  
  // Only for 'credit' refund
  customerBalanceAfter?: 24000,
  
  message: "Return processed successfully",
  messageAr: "تم معالجة المرتجع بنجاح"
}
```

#### Business Logic

```typescript
async createReturn(dto: CreateReturnDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate sale
    const sale = await tx.sale.findUnique({
      where: { id: dto.saleId },
      include: {
        saleLines: {
          include: {
            costAllocations: true,
            item: true
          }
        },
        customer: true
      }
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.status === 'returned') {
      throw new BadRequestException({
        code: 'ALREADY_RETURNED',
        message: 'This sale has already been fully returned',
        messageAr: 'تم إرجاع هذه الفاتورة بالكامل مسبقاً'
      });
    }

    // 2. Validate return items
    let totalAmount = 0;
    let totalCost = 0;
    const lineData = [];

    for (const item of dto.items) {
      const saleLine = sale.saleLines.find(l => l.id === item.saleLineId);
      if (!saleLine) {
        throw new BadRequestException({
          code: 'INVALID_LINE',
          message: `Sale line ${item.saleLineId} not found`,
          messageAr: 'بند الفاتورة غير موجود'
        });
      }

      // Check if quantity is valid
      const previouslyReturned = await getPreviouslyReturnedQuantity(tx, item.saleLineId);
      const maxReturnable = saleLine.quantity.toNumber() - previouslyReturned;
      
      if (item.quantity > maxReturnable) {
        throw new BadRequestException({
          code: 'EXCEEDS_QUANTITY',
          message: `Cannot return more than sold (max: ${maxReturnable})`,
          messageAr: `لا يمكن إرجاع أكثر من الكمية المباعة (الحد: ${maxReturnable})`
        });
      }

      // Calculate proportional cost (FIFO)
      const costRatio = item.quantity / saleLine.quantity.toNumber();
      const lineCost = Math.round(saleLine.costAmount * costRatio);
      const lineAmount = item.quantity * saleLine.unitPrice;

      totalAmount += lineAmount;
      totalCost += lineCost;

      lineData.push({
        saleLine,
        ...item,
        lineAmount,
        lineCost
      });
    }

    // 3. Generate return number
    const returnNumber = await generateReturnNumber(tx);

    // 4. Create return record
    const returnRecord = await tx.return.create({
      data: {
        returnNumber,
        saleId: dto.saleId,
        customerId: sale.customerId,
        branchId: dto.branchId,
        processedBy: userId,
        returnDate: new Date(),
        totalAmount,
        totalCost,
        refundMethod: dto.refundMethod,
        status: 'completed',
        reason: dto.reason,
        notes: dto.notes
      }
    });

    // 5. Create return lines and handle inventory
    for (const line of lineData) {
      let restockLotId: number | null = null;

      if (line.condition === 'good' && line.restockToInventory) {
        // Create new lot for restocked items
        const lotNumber = await generateLotNumber('RET');
        const restockLot = await tx.inventoryLot.create({
          data: {
            lotNumber,
            itemId: line.saleLine.itemId,
            branchId: dto.branchId,
            receivedAt: new Date(),
            initialQuantity: line.quantity,
            currentQuantity: line.quantity,
            costPerUnit: Math.round(line.lineCost / line.quantity),
            status: 'available'
          }
        });
        restockLotId = restockLot.id;

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            lotId: restockLot.id,
            movementType: 'return',
            quantity: line.quantity,
            referenceType: 'Return',
            referenceId: returnRecord.id,
            reason: `Return from sale ${sale.invoiceNumber}`,
            userId,
            branchId: dto.branchId
          }
        });

        // Update inventory aggregate
        await updateInventoryTotal(tx, line.saleLine.itemId, dto.branchId, line.quantity);
      } else if (line.condition !== 'good') {
        // Record as wastage
        await recordWastageFromReturn(tx, {
          itemId: line.saleLine.itemId,
          branchId: dto.branchId,
          quantity: line.quantity,
          cost: line.lineCost,
          reason: `Return (${line.condition}): ${dto.reason}`,
          userId
        });
      }

      await tx.returnLine.create({
        data: {
          returnId: returnRecord.id,
          saleLineId: line.saleLineId,
          itemId: line.saleLine.itemId,
          quantity: line.quantity,
          unitPrice: line.saleLine.unitPrice,
          lineAmount: line.lineAmount,
          costAmount: line.lineCost,
          condition: line.condition,
          restockLotId
        }
      });
    }

    // 6. Handle refund
    if (dto.refundMethod === 'cash') {
      // Cash refund - just record
    } else if (dto.refundMethod === 'credit' && sale.customerId) {
      // Credit to customer account - reduce debt
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          currentBalance: { decrement: totalAmount }
        }
      });

      // Find unpaid debts and reduce
      await allocateCreditToDebts(tx, sale.customerId, totalAmount);
    }

    // 7. Update sale status
    const isFullReturn = await checkIfFullReturn(tx, dto.saleId);
    await tx.sale.update({
      where: { id: dto.saleId },
      data: {
        status: isFullReturn ? 'returned' : 'partial_return'
      }
    });

    // 8. Create journal entry
    await createReturnJournalEntry(tx, {
      returnId: returnRecord.id,
      returnNumber,
      branchId: dto.branchId,
      totalAmount,
      totalCost,
      refundMethod: dto.refundMethod,
      customerId: sale.customerId,
      hasWastage: lineData.some(l => l.condition !== 'good')
    });

    return returnRecord;
  });
}
```

#### Accounting Entries

**Cash Refund + Restock:**
```
DR: Sales Returns & Allowances    16.000 SAR
CR: Cash                          16.000 SAR

DR: Inventory                     10.000 SAR
CR: Cost of Goods Sold            10.000 SAR
```

**Credit Refund + Wastage:**
```
DR: Sales Returns & Allowances    16.000 SAR
CR: Accounts Receivable           16.000 SAR

DR: Wastage Expense               10.000 SAR
CR: Cost of Goods Sold            10.000 SAR
```

---

### 9.2 List Returns

```http
GET /returns?saleId=42&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  returns: [
    {
      id: 5,
      returnNumber: "RET-0005",
      saleInvoice: "SAL-0042",
      customerName: "أحمد محمد",
      branchName: "الفرع الرئيسي",
      
      returnDate: "2026-02-10T15:00:00Z",
      
      totalAmount: 16000,
      totalCost: 10000,
      
      refundMethod: "cash",
      status: "completed",
      reason: "Customer changed mind",
      itemCount: 1
    }
  ],
  
  summary: {
    totalReturns: 15,
    totalRefunded: 85000,
    totalCostRecovered: 55000,
    byCondition: {
      good: { count: 10, amount: 60000 },
      damaged: { count: 3, amount: 15000 },
      expired: { count: 2, amount: 10000 }
    }
  },
  
  pagination: { ... }
}
```

---

### 9.3 Record Wastage

```http
POST /wastage
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  branchId: number;
  
  items: [
    {
      lotId: number;            // Which lot to deduct from
      quantity: number;
    }
  ];
  
  wastageType: 'expired' | 'damaged' | 'spoiled' | 'theft';
  reason: string;
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  wastages: [
    {
      id: 10,
      wastageNumber: "WST-0010",
      itemId: 10,
      itemName: "دجاج كامل",
      lotNumber: "LOT-20260206-001",
      
      quantity: 5.000,
      costPerUnit: 5000,
      totalCost: 25000,          // 25.000 SAR loss
      
      wastageType: "expired",
      reason: "Passed expiry date",
      
      branchName: "الفرع الرئيسي",
      recordedByName: "admin",
      
      wastageDate: "2026-02-10T16:00:00Z"
    }
  ],
  
  totalWastageCost: 25000,
  
  message: "Wastage recorded successfully",
  messageAr: "تم تسجيل الهدر بنجاح"
}
```

#### Business Logic

```typescript
async recordWastage(dto: RecordWastageDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const wastages = [];
    let totalCost = 0;

    for (const item of dto.items) {
      // Validate lot
      const lot = await tx.inventoryLot.findUnique({
        where: { id: item.lotId },
        include: { item: true }
      });

      if (!lot) {
        throw new NotFoundException(`Lot ${item.lotId} not found`);
      }

      if (lot.currentQuantity.toNumber() < item.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_QUANTITY',
          message: `Lot only has ${lot.currentQuantity} available`,
          messageAr: `الدفعة بها ${lot.currentQuantity} فقط متاحة`
        });
      }

      // Generate wastage number
      const wastageNumber = await generateWastageNumber(tx);
      const itemCost = item.quantity * lot.costPerUnit;

      // Create wastage record
      const wastage = await tx.wastage.create({
        data: {
          wastageNumber,
          lotId: item.lotId,
          itemId: lot.itemId,
          branchId: dto.branchId,
          recordedBy: userId,
          wastageDate: new Date(),
          quantity: item.quantity,
          costPerUnit: lot.costPerUnit,
          totalCost: itemCost,
          wastageType: dto.wastageType,
          reason: dto.reason,
          notes: dto.notes
        }
      });

      // Deduct from lot
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          currentQuantity: { decrement: item.quantity },
          status: lot.currentQuantity.toNumber() - item.quantity <= 0 
            ? 'depleted' 
            : 'available'
        }
      });

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          lotId: lot.id,
          movementType: 'wastage',
          quantity: -item.quantity,
          referenceType: 'Wastage',
          referenceId: wastage.id,
          reason: dto.reason,
          userId,
          branchId: dto.branchId
        }
      });

      // Update inventory aggregate
      await updateInventoryTotal(tx, lot.itemId, dto.branchId, -item.quantity);

      wastages.push({
        ...wastage,
        itemName: lot.item.name,
        lotNumber: lot.lotNumber
      });

      totalCost += itemCost;
    }

    // Create journal entry for wastage
    await createWastageJournalEntry(tx, {
      branchId: dto.branchId,
      totalCost,
      wastageType: dto.wastageType,
      reason: dto.reason
    });

    return { wastages, totalCost };
  });
}
```

#### Accounting Entry

```
DR: Wastage/Shrinkage Expense     25.000 SAR
CR: Inventory                     25.000 SAR
```

---

### 9.4 List Wastages

```http
GET /wastage?branchId=1&wastageType=expired&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  wastages: [
    {
      id: 10,
      wastageNumber: "WST-0010",
      itemName: "دجاج كامل",
      lotNumber: "LOT-20260206-001",
      branchName: "الفرع الرئيسي",
      recordedByName: "admin",
      
      wastageDate: "2026-02-10T16:00:00Z",
      
      quantity: 5.000,
      costPerUnit: 5000,
      totalCost: 25000,
      
      wastageType: "expired",
      reason: "Passed expiry date"
    }
  ],
  
  summary: {
    totalWastages: 20,
    totalQuantity: 50.000,
    totalCost: 150000,
    byType: {
      expired: { count: 10, cost: 75000 },
      damaged: { count: 6, cost: 45000 },
      spoiled: { count: 3, cost: 20000 },
      theft: { count: 1, cost: 10000 }
    }
  },
  
  pagination: { ... }
}
```

---

### 9.5 Get Wastage Summary Report

```http
GET /wastage/summary?branchId=1&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  
  summary: {
    totalWastages: 20,
    totalCost: 150000,
    percentageOfPurchases: 3.5,  // 3.5% of purchase value
    percentageOfSales: 2.8       // 2.8% of sales value
  },
  
  byItem: [
    {
      itemId: 10,
      itemName: "دجاج كامل",
      totalQuantity: 25.000,
      totalCost: 75000,
      percentage: 50.0           // 50% of total wastage
    }
  ],
  
  byType: [
    {
      type: "expired",
      count: 10,
      quantity: 30.000,
      cost: 75000,
      percentage: 50.0
    }
  ],
  
  trend: [                       // Daily trend
    {
      date: "2026-02-08",
      count: 2,
      cost: 15000
    }
  ]
}
```

---

## Error Codes

| Code | HTTP | Message (EN) | Message (AR) |
|------|------|--------------|--------------|
| `RETURN_NOT_FOUND` | 404 | Return not found | المرتجع غير موجود |
| `SALE_NOT_FOUND` | 404 | Sale not found | الفاتورة غير موجودة |
| `ALREADY_RETURNED` | 400 | Already fully returned | تم الإرجاع بالكامل مسبقاً |
| `INVALID_LINE` | 400 | Sale line not found | بند الفاتورة غير موجود |
| `EXCEEDS_QUANTITY` | 400 | Exceeds sold quantity | يتجاوز الكمية المباعة |
| `INSUFFICIENT_QUANTITY` | 400 | Lot has insufficient quantity | الدفعة لا تحتوي كمية كافية |

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `POST /returns` | 📋 To Implement | returns.controller.ts |
| `GET /returns` | 📋 To Implement | returns.controller.ts |
| `GET /returns/:id` | 📋 To Implement | returns.controller.ts |
| `POST /wastage` | 📋 To Implement | wastage.controller.ts |
| `GET /wastage` | 📋 To Implement | wastage.controller.ts |
| `GET /wastage/summary` | 📋 To Implement | wastage.controller.ts |
