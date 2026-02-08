# Module 06: Purchases & Suppliers

> **Status**: 📋 To Implement  
> **Priority**: P0 - Critical  
> **PRD Reference**: Purchases & Supplier Management (High)

---

## Overview

This module handles:
1. **Supplier management** - Vendor information and tracking
2. **Purchase orders** - Receiving inventory from suppliers
3. **Lot creation** - Every purchase creates inventory lots
4. **Supplier debt** - Track amounts owed to suppliers
5. **Purchase returns** - Return defective goods to suppliers

---

## Purchase Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      PURCHASE FLOW                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SELECT SUPPLIER                                          │
│     مزارع الراشد (Al-Rashid Farms)                           │
│                                                              │
│  2. ADD ITEMS                                                │
│     ┌─────────────────────────────────────────────────────┐  │
│     │ Item: دجاج كامل       Qty: 100 kg                   │  │
│     │ Cost: 5.000 SAR/kg    Total: 500.000 SAR           │  │
│     │ Expiry: 2026-02-15    Storage: ثلاجة أ              │  │
│     └─────────────────────────────────────────────────────┘  │
│                                                              │
│  3. PAYMENT                                                  │
│     ○ Cash (نقداً) - Paid now                               │
│     ○ Credit (آجل) - Creates supplier debt                  │
│     ○ Partial (جزئي) - Pay now + debt                       │
│                                                              │
│  4. RESULT                                                   │
│     ✓ Inventory lot created: LOT-20260208-001               │
│     ✓ Stock updated: +100 kg                                │
│     ✓ Journal entry: DR Inventory, CR Cash/Payable          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Supplier

```prisma
model Supplier {
  id              Int       @id @default(autoincrement())
  code            String    @unique
  name            String
  nameEn          String?   @map("name_en")
  phone           String?
  email           String?
  address         String?
  taxNumber       String?   @map("tax_number")
  
  contactPerson   String?   @map("contact_person")
  paymentTerms    String?   @map("payment_terms")  // e.g., "Net 30"
  
  currentBalance  Int       @default(0) @map("current_balance")  // Amount we owe
  
  isActive        Boolean   @default(true)
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  purchases       Purchase[]
  inventoryLots   InventoryLot[]
  payments        SupplierPayment[]
}
```

### Purchase

```prisma
model Purchase {
  id              Int       @id @default(autoincrement())
  purchaseNumber  String    @unique @map("purchase_number")
  supplierId      Int       @map("supplier_id")
  branchId        Int       @map("branch_id")
  receivedBy      Int       @map("received_by")
  
  purchaseDate    DateTime  @default(now()) @map("purchase_date")
  
  // Amounts (minor units)
  subtotal        Int
  discountAmount  Int       @default(0) @map("discount_amount")
  taxAmount       Int       @default(0) @map("tax_amount")
  totalAmount     Int       @map("total_amount")
  
  // Payment
  paymentMethod   String    @map("payment_method")  // 'cash', 'credit', 'partial'
  amountPaid      Int       @map("amount_paid")
  amountDue       Int       @map("amount_due")
  
  status          String    @default("completed")  // 'completed', 'returned', 'partial_return'
  
  invoiceNumber   String?   @map("invoice_number")  // Supplier's invoice
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  supplier        Supplier  @relation(fields: [supplierId], references: [id])
  branch          Branch    @relation(fields: [branchId], references: [id])
  receiver        User      @relation(fields: [receivedBy], references: [id])
  
  purchaseLines   PurchaseLine[]
  inventoryLots   InventoryLot[]
  journalEntry    JournalEntry?
}
```

### PurchaseLine

```prisma
model PurchaseLine {
  id              Int       @id @default(autoincrement())
  purchaseId      Int       @map("purchase_id")
  itemId          Int       @map("item_id")
  
  quantity        Decimal
  unitCost        Int       @map("unit_cost")      // Cost per unit
  discount        Int       @default(0)
  lineTotal       Int       @map("line_total")
  
  expiryDate      DateTime? @map("expiry_date")
  storageLocation String?   @map("storage_location")
  
  createdAt       DateTime  @default(now())

  // Relations
  purchase        Purchase  @relation(fields: [purchaseId], references: [id])
  item            Item      @relation(fields: [itemId], references: [id])
}
```

---

## API Endpoints

### 6.1 Create Supplier

```http
POST /suppliers
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
  taxNumber?: string;
  contactPerson?: string;
  paymentTerms?: string;         // e.g., "Net 30", "COD"
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  supplier: {
    id: 5,
    code: "SUP-0005",
    name: "مزارع الراشد",
    nameEn: "Al-Rashid Farms",
    phone: "0501234567",
    email: "info@alrashid.com",
    address: "المنطقة الصناعية، الرياض",
    taxNumber: "300123456789003",
    contactPerson: "خالد الراشد",
    paymentTerms: "Net 30",
    currentBalance: 0,
    isActive: true,
    notes: null
  },
  message: "Supplier created successfully",
  messageAr: "تم إنشاء المورد بنجاح"
}
```

#### Business Logic

```typescript
async createSupplier(dto: CreateSupplierDto) {
  // Generate supplier code
  const code = await generateSupplierCode();
  
  // Check for duplicate name
  const existing = await prisma.supplier.findFirst({
    where: { name: dto.name }
  });
  
  if (existing) {
    throw new ConflictException({
      code: 'DUPLICATE_SUPPLIER',
      message: 'Supplier with this name already exists',
      messageAr: 'يوجد مورد بهذا الاسم مسبقاً'
    });
  }
  
  return prisma.supplier.create({
    data: {
      code,
      ...dto
    }
  });
}
```

---

### 6.2 List Suppliers

```http
GET /suppliers?search=الراشد&isActive=true
```

**Access**: 🔒 Admin, Cashier (read-only)

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name, code, phone |
| `isActive` | boolean | Filter by status |
| `hasBalance` | boolean | Only suppliers we owe money to |

#### Response (Success - 200)

```typescript
{
  suppliers: [
    {
      id: 5,
      code: "SUP-0005",
      name: "مزارع الراشد",
      nameEn: "Al-Rashid Farms",
      phone: "0501234567",
      contactPerson: "خالد الراشد",
      currentBalance: 250000,  // 250.000 SAR we owe
      isActive: true,
      lastPurchaseDate: "2026-02-08"
    }
  ],
  totalSuppliers: 10,
  totalBalance: 750000  // Total we owe all suppliers
}
```

---

### 6.3 Update Supplier

```http
PUT /suppliers/:id
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
  taxNumber?: string;
  contactPerson?: string;
  paymentTerms?: string;
  notes?: string;
}
```

---

### 6.4 Deactivate Supplier

```http
PUT /suppliers/:id/deactivate
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  supplier: {
    id: 5,
    name: "مزارع الراشد",
    isActive: false
  },
  message: "Supplier deactivated successfully",
  messageAr: "تم إلغاء تفعيل المورد بنجاح"
}
```

---

### 6.5 Create Purchase

```http
POST /purchases
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  supplierId: number;
  branchId: number;
  
  items: [
    {
      itemId: number;
      quantity: number;           // In item's unit
      unitCost: number;           // Minor units (cost per unit)
      discount?: number;          // Line discount
      expiryDate?: string;        // ISO date
      storageLocation?: string;
    }
  ];
  
  discountAmount?: number;        // Invoice-level discount
  taxAmount?: number;             // VAT if applicable
  
  paymentMethod: 'cash' | 'credit' | 'partial';
  amountPaid?: number;            // Required for partial
  
  invoiceNumber?: string;         // Supplier's invoice number
  notes?: string;
}
```

#### Response (Success - 201)

```typescript
{
  purchase: {
    id: 15,
    purchaseNumber: "PUR-0015",
    supplierId: 5,
    supplierName: "مزارع الراشد",
    branchId: 1,
    branchName: "الفرع الرئيسي",
    
    purchaseDate: "2026-02-08T10:00:00Z",
    
    lines: [
      {
        id: 30,
        itemId: 10,
        itemCode: "CHIC-001",
        itemName: "دجاج كامل",
        quantity: 100.000,
        unitCost: 5000,            // 5.000 SAR
        discount: 0,
        lineTotal: 500000,         // 500.000 SAR
        expiryDate: "2026-02-15",
        storageLocation: "ثلاجة أ",
        
        // Lot created
        lot: {
          id: 101,
          lotNumber: "LOT-20260208-001"
        }
      }
    ],
    
    subtotal: 500000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 500000,
    
    paymentMethod: "cash",
    amountPaid: 500000,
    amountDue: 0,
    
    status: "completed",
    invoiceNumber: "SUP-INV-12345"
  },
  message: "Purchase recorded successfully",
  messageAr: "تم تسجيل المشتريات بنجاح"
}
```

#### Business Logic

```typescript
async createPurchase(dto: CreatePurchaseDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate supplier
    const supplier = await tx.supplier.findUnique({
      where: { id: dto.supplierId }
    });
    
    if (!supplier || !supplier.isActive) {
      throw new NotFoundException('Supplier not found or inactive');
    }
    
    // 2. Calculate totals
    let subtotal = 0;
    const lineData = [];
    
    for (const item of dto.items) {
      const dbItem = await tx.item.findUnique({ where: { id: item.itemId } });
      if (!dbItem) throw new NotFoundException(`Item ${item.itemId} not found`);
      
      const lineDiscount = item.discount || 0;
      const lineTotal = (item.quantity * item.unitCost) - lineDiscount;
      subtotal += lineTotal;
      
      lineData.push({
        item: dbItem,
        ...item,
        lineTotal
      });
    }
    
    const discountAmount = dto.discountAmount || 0;
    const taxAmount = dto.taxAmount || 0;
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    // 3. Handle payment
    let amountPaid = totalAmount;
    let amountDue = 0;
    
    if (dto.paymentMethod === 'credit') {
      amountPaid = 0;
      amountDue = totalAmount;
    } else if (dto.paymentMethod === 'partial') {
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
    
    // 4. Generate purchase number
    const purchaseNumber = await generatePurchaseNumber(tx);
    
    // 5. Create purchase record
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: dto.supplierId,
        branchId: dto.branchId,
        receivedBy: userId,
        purchaseDate: new Date(),
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        amountPaid,
        amountDue,
        status: 'completed',
        invoiceNumber: dto.invoiceNumber,
        notes: dto.notes
      }
    });
    
    // 6. Create lines, lots, and update inventory
    for (const line of lineData) {
      // Create purchase line
      const purchaseLine = await tx.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          itemId: line.itemId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          discount: line.discount || 0,
          lineTotal: line.lineTotal,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          storageLocation: line.storageLocation
        }
      });
      
      // Create inventory lot
      const lotNumber = await generateLotNumber('LOT');
      const lot = await tx.inventoryLot.create({
        data: {
          lotNumber,
          itemId: line.itemId,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          purchaseId: purchase.id,
          receivedAt: new Date(),
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          storageLocation: line.storageLocation,
          initialQuantity: line.quantity,
          currentQuantity: line.quantity,
          costPerUnit: line.unitCost,
          status: 'available'
        }
      });
      
      // Create stock movement
      await tx.stockMovement.create({
        data: {
          lotId: lot.id,
          movementType: 'purchase',
          quantity: line.quantity,
          referenceType: 'Purchase',
          referenceId: purchase.id,
          userId,
          branchId: dto.branchId
        }
      });
      
      // Update inventory aggregate
      await upsertInventory(tx, line.itemId, dto.branchId, line.quantity);
    }
    
    // 7. Update supplier balance if credit
    if (amountDue > 0) {
      await tx.supplier.update({
        where: { id: dto.supplierId },
        data: {
          currentBalance: { increment: amountDue }
        }
      });
    }
    
    // 8. Create journal entry
    await createPurchaseJournalEntry(tx, {
      purchaseId: purchase.id,
      purchaseNumber,
      branchId: dto.branchId,
      totalAmount,
      amountPaid,
      amountDue,
      supplierId: dto.supplierId
    });
    
    return purchase;
  });
}
```

#### Accounting Entries

**Cash Purchase:**
```
DR: Inventory                 500.000 SAR (cost of goods)
CR: Cash                      500.000 SAR
```

**Credit Purchase:**
```
DR: Inventory                 500.000 SAR
CR: Accounts Payable          500.000 SAR (supplier debt)
```

**Partial Payment:**
```
DR: Inventory                 500.000 SAR
CR: Cash                      250.000 SAR (amount paid)
CR: Accounts Payable          250.000 SAR (debt)
```

---

### 6.6 List Purchases

```http
GET /purchases?supplierId=5&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `branchId` | number | Filter by branch |
| `supplierId` | number | Filter by supplier |
| `from` | date | Start date |
| `to` | date | End date |
| `paymentMethod` | string | 'cash', 'credit', 'partial' |
| `status` | string | 'completed', 'returned' |

#### Response (Success - 200)

```typescript
{
  purchases: [
    {
      id: 15,
      purchaseNumber: "PUR-0015",
      supplierName: "مزارع الراشد",
      branchName: "الفرع الرئيسي",
      purchaseDate: "2026-02-08T10:00:00Z",
      
      totalAmount: 500000,
      amountPaid: 500000,
      amountDue: 0,
      
      paymentMethod: "cash",
      status: "completed",
      itemCount: 1
    }
  ],
  
  summary: {
    totalPurchases: 50,
    totalAmount: 2500000,
    totalPaid: 2000000,
    totalOutstanding: 500000
  },
  
  pagination: { ... }
}
```

---

### 6.7 Get Purchase Details

```http
GET /purchases/:id
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  purchase: {
    id: 15,
    purchaseNumber: "PUR-0015",
    
    supplier: {
      id: 5,
      code: "SUP-0005",
      name: "مزارع الراشد",
      phone: "0501234567"
    },
    
    branch: {
      id: 1,
      name: "الفرع الرئيسي"
    },
    
    receiver: {
      id: 1,
      name: "admin"
    },
    
    purchaseDate: "2026-02-08T10:00:00Z",
    
    lines: [
      {
        id: 30,
        item: {
          id: 10,
          code: "CHIC-001",
          name: "دجاج كامل",
          unitOfMeasure: "kg"
        },
        quantity: 100.000,
        unitCost: 5000,
        discount: 0,
        lineTotal: 500000,
        expiryDate: "2026-02-15",
        storageLocation: "ثلاجة أ",
        lot: {
          id: 101,
          lotNumber: "LOT-20260208-001",
          currentQuantity: 75.000
        }
      }
    ],
    
    subtotal: 500000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 500000,
    
    paymentMethod: "cash",
    amountPaid: 500000,
    amountDue: 0,
    
    status: "completed",
    invoiceNumber: "SUP-INV-12345",
    notes: null
  }
}
```

---

### 6.8 Get Supplier Statement

```http
GET /suppliers/:id/statement?from=2026-01-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  supplier: {
    id: 5,
    name: "مزارع الراشد",
    code: "SUP-0005"
  },
  
  period: {
    from: "2026-01-01",
    to: "2026-02-28"
  },
  
  openingBalance: 100000,      // 100.000 SAR at start
  
  transactions: [
    {
      date: "2026-01-15",
      type: "purchase",
      reference: "PUR-0010",
      description: "مشتريات دجاج",
      debit: 250000,           // Increased what we owe
      credit: 0,
      balance: 350000
    },
    {
      date: "2026-01-20",
      type: "payment",
      reference: "SPAY-0005",
      description: "دفعة للمورد",
      debit: 0,
      credit: 200000,          // Reduced what we owe
      balance: 150000
    },
    {
      date: "2026-02-08",
      type: "purchase",
      reference: "PUR-0015",
      description: "مشتريات دجاج ولحم",
      debit: 500000,
      credit: 0,
      balance: 650000
    }
  ],
  
  totalPurchases: 750000,
  totalPayments: 200000,
  closingBalance: 650000       // What we owe now
}
```

---

### 6.9 Cancel Purchase

```http
POST /purchases/:id/cancel
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
async cancelPurchase(purchaseId: number, reason: string, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        purchaseLines: true,
        inventoryLots: true
      }
    });

    if (!purchase) throw new NotFoundException('Purchase not found');

    // Check if any inventory from this purchase has been sold
    for (const lot of purchase.inventoryLots) {
      if (lot.currentQuantity.toNumber() < lot.initialQuantity.toNumber()) {
        throw new BadRequestException({
          code: 'INVENTORY_ALREADY_USED',
          message: 'Cannot cancel: some inventory has already been sold',
          messageAr: 'لا يمكن الإلغاء: تم بيع جزء من المخزون'
        });
      }
    }

    // 1. Delete inventory lots
    for (const lot of purchase.inventoryLots) {
      await tx.stockMovement.create({
        data: {
          lotId: lot.id,
          movementType: 'adjustment',
          quantity: -lot.currentQuantity.toNumber(),
          referenceType: 'PurchaseCancellation',
          referenceId: purchase.id,
          reason,
          userId,
          branchId: purchase.branchId
        }
      });

      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: {
          currentQuantity: 0,
          status: 'cancelled'
        }
      });

      // Update inventory aggregate
      await updateInventoryTotal(tx, lot.itemId, purchase.branchId, -lot.initialQuantity.toNumber());
    }

    // 2. Reduce supplier balance
    if (purchase.amountDue > 0) {
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: {
          currentBalance: { decrement: purchase.amountDue }
        }
      });
    }

    // 3. Update purchase status
    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        status: 'cancelled',
        notes: `${purchase.notes || ''}\n[CANCELLED: ${reason}]`
      }
    });

    // 4. Create reversal journal entry
    await createPurchaseCancellationJournalEntry(tx, purchase, reason);

    return { message: 'Purchase cancelled successfully' };
  });
}
```

---

## Error Codes

| Code | HTTP | Message (EN) | Message (AR) |
|------|------|--------------|--------------|
| `SUPPLIER_NOT_FOUND` | 404 | Supplier not found | المورد غير موجود |
| `DUPLICATE_SUPPLIER` | 409 | Supplier already exists | المورد موجود مسبقاً |
| `INVALID_PAYMENT` | 400 | Invalid payment amount | مبلغ الدفع غير صالح |
| `PURCHASE_NOT_FOUND` | 404 | Purchase not found | المشتريات غير موجودة |
| `INVENTORY_ALREADY_USED` | 400 | Inventory already sold | تم بيع المخزون |
| `SUPPLIER_HAS_BALANCE` | 400 | Supplier has outstanding balance | المورد له رصيد متبقي |

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `POST /suppliers` | 📋 To Implement | suppliers.controller.ts |
| `GET /suppliers` | 📋 To Implement | suppliers.controller.ts |
| `PUT /suppliers/:id` | 📋 To Implement | suppliers.controller.ts |
| `PUT /suppliers/:id/deactivate` | 📋 To Implement | suppliers.controller.ts |
| `POST /purchases` | 📋 To Implement | purchases.controller.ts |
| `GET /purchases` | 📋 To Implement | purchases.controller.ts |
| `GET /purchases/:id` | 📋 To Implement | purchases.controller.ts |
| `GET /suppliers/:id/statement` | 📋 To Implement | suppliers.controller.ts |
| `POST /purchases/:id/cancel` | 📋 To Implement | purchases.controller.ts |
