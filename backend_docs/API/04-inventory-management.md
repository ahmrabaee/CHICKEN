# Module 04: Inventory Management

> **Status**: 📋 To Implement  
> **Priority**: P0 - Critical  
> **PRD Reference**: Inventory & Batch Management (High)

---

## Overview

This module handles:
1. **Batch/Lot tracking** - Every purchase creates inventory lots
2. **FIFO costing** - First-In-First-Out cost allocation
3. **Stock per branch** - Inventory tracked separately per branch
4. **Expiry tracking** - Alert on expiring batches
5. **Stock movements** - Full audit trail of inventory changes
6. **Stock adjustments** - Admin corrections

---

## Core Concepts

### Inventory Lot (Batch)

Every inventory item is tracked by **lot/batch**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Inventory Lot                           │
├─────────────────────────────────────────────────────────────┤
│  Lot Number:     LOT-20260208-001                          │
│  Item:           Whole Chicken (دجاج كامل)                 │
│  Branch:         Main Branch                                │
│  Supplier:       Al-Rashid Farms                           │
│  ─────────────────────────────────────────────             │
│  Received Date:  2026-02-08                                 │
│  Expiry Date:    2026-02-15 (7 days)                       │
│  Storage:        Refrigerator A                            │
│  ─────────────────────────────────────────────             │
│  Initial Qty:    100 kg                                    │
│  Current Qty:    75 kg  (25 kg sold)                       │
│  Cost/Unit:      5.500 SAR/kg                              │
│  Status:         available                                  │
└─────────────────────────────────────────────────────────────┘
```

### FIFO (First-In-First-Out)

When selling inventory:
1. **Always use oldest lots first**
2. Calculate cost based on which lots are depleted
3. Profit = Sale Price - FIFO Cost

```
Example: Selling 30 kg of Chicken

Available Lots (ordered by receivedAt):
  LOT-001: 20 kg @ 5.000 SAR/kg (2 days old)
  LOT-002: 50 kg @ 5.500 SAR/kg (1 day old)

FIFO Allocation:
  20 kg from LOT-001 @ 5.000 = 100.000 SAR
  10 kg from LOT-002 @ 5.500 =  55.000 SAR
  ─────────────────────────────────────────
  Total Cost:                  155.000 SAR
  
If sold at 8.000 SAR/kg:
  Revenue: 30 × 8.000 = 240.000 SAR
  Cost:                 155.000 SAR
  Profit:                85.000 SAR
```

---

## Database Models

### Item (Product)

```prisma
model Item {
  id              Int      @id @default(autoincrement())
  code            String   @unique
  name            String              // Arabic
  nameEn          String?  @map("name_en")
  barcode         String?  @unique
  categoryId      Int      @map("category_id")
  unitOfMeasure   String   @map("unit_of_measure")  // 'kg', 'piece', 'box'
  minStockLevel   Decimal? @map("min_stock_level")
  sellingPrice    Int      @map("selling_price")    // Minor units (fils)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  category        Category  @relation(fields: [categoryId], references: [id])
  inventoryLots   InventoryLot[]
  inventory       Inventory[]
}
```

### Inventory (Aggregate per Branch)

```prisma
model Inventory {
  id              Int      @id @default(autoincrement())
  itemId          Int      @map("item_id")
  branchId        Int      @map("branch_id")
  totalQuantity   Decimal  @default(0) @map("total_quantity")
  reservedQty     Decimal  @default(0) @map("reserved_qty")
  updatedAt       DateTime @updatedAt

  // Relations
  item            Item     @relation(fields: [itemId], references: [id])
  branch          Branch   @relation(fields: [branchId], references: [id])

  @@unique([itemId, branchId])
}
```

### InventoryLot (Batch)

```prisma
model InventoryLot {
  id              Int       @id @default(autoincrement())
  lotNumber       String    @unique @map("lot_number")
  itemId          Int       @map("item_id")
  branchId        Int       @map("branch_id")
  supplierId      Int?      @map("supplier_id")
  purchaseId      Int?      @map("purchase_id")
  
  receivedAt      DateTime  @map("received_at")
  expiryDate      DateTime? @map("expiry_date")
  storageLocation String?   @map("storage_location")
  
  initialQuantity Decimal   @map("initial_quantity")
  currentQuantity Decimal   @map("current_quantity")
  costPerUnit     Int       @map("cost_per_unit")  // Minor units
  
  status          String    @default("available")  // available, depleted, expired, transferred
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  item            Item      @relation(fields: [itemId], references: [id])
  branch          Branch    @relation(fields: [branchId], references: [id])
  supplier        Supplier? @relation(fields: [supplierId], references: [id])
  purchase        Purchase? @relation(fields: [purchaseId], references: [id])
  
  saleAllocations SaleLineCostAllocation[]
  stockMovements  StockMovement[]
}
```

### StockMovement (Audit Trail)

```prisma
model StockMovement {
  id              Int       @id @default(autoincrement())
  lotId           Int       @map("lot_id")
  movementType    String    @map("movement_type")  // 'purchase', 'sale', 'adjustment', 'transfer', 'wastage', 'return'
  quantity        Decimal                          // Positive = in, Negative = out
  referenceType   String?   @map("reference_type") // 'Sale', 'Purchase', 'Adjustment'
  referenceId     Int?      @map("reference_id")
  reason          String?
  userId          Int       @map("user_id")
  branchId        Int       @map("branch_id")
  timestamp       DateTime  @default(now())

  // Relations
  lot             InventoryLot @relation(fields: [lotId], references: [id])
  user            User         @relation(fields: [userId], references: [id])
  branch          Branch       @relation(fields: [branchId], references: [id])
}
```

---

## API Endpoints

### 4.1 List Inventory

```http
GET /inventory?branchId=1&categoryId=2&lowStock=true&expiringSoon=true
```

**Access**: 🔒 Admin, Cashier

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `branchId` | number | Filter by branch |
| `categoryId` | number | Filter by category |
| `lowStock` | boolean | Only items below min stock |
| `expiringSoon` | boolean | Batches expiring within alert days |
| `search` | string | Search by name, code, barcode |

#### Response (Success - 200)

```typescript
{
  items: [
    {
      id: 1,
      itemId: 10,
      itemCode: "CHIC-001",
      itemName: "دجاج كامل",
      itemNameEn: "Whole Chicken",
      barcode: "6281234567890",
      categoryName: "دواجن",
      branchId: 1,
      branchName: "الفرع الرئيسي",
      
      totalQuantity: 75.500,      // kg
      availableQuantity: 70.000,   // Excluding expired
      unitOfMeasure: "kg",
      minStockLevel: 50.000,
      isLowStock: false,           // Computed
      
      sellingPrice: 8000,          // 8.000 SAR (minor units)
      avgCostPrice: 5250,          // 5.250 SAR (hidden from cashier)
      
      batches: [
        {
          lotId: 101,
          lotNumber: "LOT-20260206-001",
          supplierId: 5,
          supplierName: "مزارع الراشد",
          receivedAt: "2026-02-06T08:00:00Z",
          expiryDate: "2026-02-13T00:00:00Z",
          quantity: 20.000,
          costPerUnit: 5000,        // Hidden from cashier
          storageLocation: "ثلاجة أ",
          isExpired: false,
          daysUntilExpiry: 5
        },
        {
          lotId: 102,
          lotNumber: "LOT-20260208-001",
          supplierId: 5,
          supplierName: "مزارع الراشد",
          receivedAt: "2026-02-08T08:00:00Z",
          expiryDate: "2026-02-15T00:00:00Z",
          quantity: 55.500,
          costPerUnit: 5500,        // Hidden from cashier
          storageLocation: "ثلاجة ب",
          isExpired: false,
          daysUntilExpiry: 7
        }
      ]
    }
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 25,
    totalPages: 2
  }
}
```

#### Business Logic

```typescript
async findAll(query: InventoryQueryDto, userRole: string) {
  const where: any = {};
  
  if (query.branchId) {
    where.branchId = query.branchId;
  }
  
  if (query.categoryId) {
    where.item = { categoryId: query.categoryId };
  }

  const inventories = await prisma.inventory.findMany({
    where,
    include: {
      item: {
        include: {
          category: true,
          inventoryLots: {
            where: {
              branchId: query.branchId,
              currentQuantity: { gt: 0 }
            },
            orderBy: { receivedAt: 'asc' },  // FIFO order
            include: {
              supplier: true
            }
          }
        }
      },
      branch: true
    }
  });

  const now = new Date();
  const alertDays = await getSettingNumber('inventory.expiry_alert_days'); // e.g., 7

  return inventories.map(inv => {
    const batches = inv.item.inventoryLots.map(lot => ({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      supplierId: lot.supplierId,
      supplierName: lot.supplier?.name,
      receivedAt: lot.receivedAt.toISOString(),
      expiryDate: lot.expiryDate?.toISOString(),
      quantity: lot.currentQuantity.toNumber(),
      costPerUnit: userRole === 'admin' ? lot.costPerUnit : undefined,  // Hide from cashier
      storageLocation: lot.storageLocation,
      isExpired: lot.expiryDate ? lot.expiryDate < now : false,
      daysUntilExpiry: lot.expiryDate ? daysDiff(now, lot.expiryDate) : null
    }));

    // Calculate available (non-expired) quantity
    const availableQuantity = batches
      .filter(b => !b.isExpired)
      .reduce((sum, b) => sum + b.quantity, 0);

    // Calculate average cost (FIFO weighted)
    const avgCostPrice = calculateWeightedAvgCost(batches);

    return {
      id: inv.id,
      itemId: inv.item.id,
      itemCode: inv.item.code,
      itemName: inv.item.name,
      itemNameEn: inv.item.nameEn,
      barcode: inv.item.barcode,
      categoryName: inv.item.category.name,
      branchId: inv.branchId,
      branchName: inv.branch.name,
      totalQuantity: inv.totalQuantity.toNumber(),
      availableQuantity,
      unitOfMeasure: inv.item.unitOfMeasure,
      minStockLevel: inv.item.minStockLevel?.toNumber(),
      isLowStock: inv.item.minStockLevel 
        ? availableQuantity < inv.item.minStockLevel.toNumber() 
        : false,
      sellingPrice: inv.item.sellingPrice,
      avgCostPrice: userRole === 'admin' ? avgCostPrice : undefined,
      batches
    };
  });
}
```

---

### 4.2 Get Item Inventory Details

```http
GET /inventory/items/:itemId?branchId=1
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  item: {
    id: 10,
    code: "CHIC-001",
    name: "دجاج كامل",
    nameEn: "Whole Chicken",
    barcode: "6281234567890",
    categoryId: 2,
    categoryName: "دواجن",
    unitOfMeasure: "kg",
    minStockLevel: 50.000,
    sellingPrice: 8000,
    costPrice: 5250,           // Hidden from cashier
    isActive: true
  },
  inventory: [                  // Per branch
    {
      branchId: 1,
      branchName: "الفرع الرئيسي",
      totalQuantity: 75.500,
      availableQuantity: 70.000,
      lots: [
        {
          lotNumber: "LOT-20260206-001",
          supplierId: 5,
          supplierName: "مزارع الراشد",
          receivedAt: "2026-02-06T08:00:00Z",
          expiryDate: "2026-02-13T00:00:00Z",
          quantity: 20.000,
          costPerUnit: 5000    // Hidden from cashier
        }
      ]
    }
  ]
}
```

---

### 4.3 Check Stock Availability (for POS)

```http
POST /inventory/check-availability
```

**Access**: 🔒 Admin, Cashier

#### Purpose
Check if items are available before completing a sale.

#### Request Body

```typescript
{
  branchId: number;
  items: [
    {
      itemId: number;
      quantity: number;
    }
  ]
}
```

#### Response (Success - 200)

```typescript
{
  available: true,
  items: [
    {
      itemId: 10,
      itemName: "دجاج كامل",
      requestedQty: 25.000,
      availableQty: 70.000,
      isAvailable: true,
      allocations: [           // Preview of FIFO allocation
        {
          lotId: 101,
          lotNumber: "LOT-20260206-001",
          quantity: 20.000,
          costPerUnit: 5000
        },
        {
          lotId: 102,
          lotNumber: "LOT-20260208-001",
          quantity: 5.000,
          costPerUnit: 5500
        }
      ]
    }
  ]
}
```

#### Business Logic

```typescript
async checkAvailability(dto: CheckAvailabilityDto) {
  const results = [];
  let allAvailable = true;

  for (const item of dto.items) {
    // Get available lots (FIFO order)
    const lots = await prisma.inventoryLot.findMany({
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

    // Calculate available quantity
    const availableQty = lots.reduce(
      (sum, lot) => sum + lot.currentQuantity.toNumber(), 
      0
    );

    const isAvailable = availableQty >= item.quantity;
    if (!isAvailable) allAvailable = false;

    // Preview FIFO allocation
    const allocations = [];
    let remaining = item.quantity;
    
    for (const lot of lots) {
      if (remaining <= 0) break;
      
      const allocQty = Math.min(lot.currentQuantity.toNumber(), remaining);
      allocations.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantity: allocQty,
        costPerUnit: lot.costPerUnit
      });
      remaining -= allocQty;
    }

    results.push({
      itemId: item.itemId,
      itemName: (await prisma.item.findUnique({ where: { id: item.itemId } }))?.name,
      requestedQty: item.quantity,
      availableQty,
      isAvailable,
      allocations
    });
  }

  return {
    available: allAvailable,
    items: results
  };
}
```

---

### 4.4 Adjust Stock

```http
POST /inventory/adjust
```

**Access**: 🔒 Admin only

#### Purpose
Manual stock corrections (count discrepancies, damage, etc.)

#### Request Body

```typescript
{
  branchId: number;
  itemId: number;
  adjustmentType: 'add' | 'subtract';
  quantity: number;
  reason: string;              // Required
  reference?: string;          // Reference number
  
  // For 'add' adjustments only:
  lotNumber?: string;          // Auto-generated if not provided
  supplierId?: number;
  expiryDate?: string;         // ISO date
  costPerUnit?: number;        // Minor units
  storageLocation?: string;
}
```

#### Response (Success - 201)

```typescript
{
  adjustment: {
    id: 50,
    type: "add",
    itemName: "دجاج كامل",
    quantity: 10.000,
    reason: "Physical count correction",
    newTotalQuantity: 85.500,
    lot: {
      lotNumber: "ADJ-20260208-001",
      receivedAt: "2026-02-08T15:00:00Z"
    }
  },
  message: "Stock adjusted successfully",
  messageAr: "تم تعديل المخزون بنجاح"
}
```

#### Business Logic

```typescript
async adjustStock(dto: AdjustStockDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException('Item not found');

    let inventory = await tx.inventory.findUnique({
      where: {
        itemId_branchId: {
          itemId: dto.itemId,
          branchId: dto.branchId
        }
      }
    });

    if (!inventory) {
      // Create inventory record if doesn't exist
      inventory = await tx.inventory.create({
        data: {
          itemId: dto.itemId,
          branchId: dto.branchId,
          totalQuantity: 0
        }
      });
    }

    if (dto.adjustmentType === 'add') {
      // Generate lot number
      const lotNumber = dto.lotNumber || await generateLotNumber('ADJ');

      // Create new lot
      const lot = await tx.inventoryLot.create({
        data: {
          lotNumber,
          itemId: dto.itemId,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          receivedAt: new Date(),
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          storageLocation: dto.storageLocation,
          initialQuantity: dto.quantity,
          currentQuantity: dto.quantity,
          costPerUnit: dto.costPerUnit || 0,
          status: 'available'
        }
      });

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          lotId: lot.id,
          movementType: 'adjustment',
          quantity: dto.quantity,
          referenceType: 'Adjustment',
          reason: dto.reason,
          userId,
          branchId: dto.branchId
        }
      });

      // Update inventory total
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          totalQuantity: { increment: dto.quantity }
        }
      });

      // Create journal entry
      await createAdjustmentJournalEntry(tx, {
        type: 'add',
        itemId: dto.itemId,
        quantity: dto.quantity,
        costPerUnit: dto.costPerUnit || 0,
        reason: dto.reason
      });

      return {
        adjustment: {
          id: lot.id,
          type: 'add',
          itemName: item.name,
          quantity: dto.quantity,
          reason: dto.reason,
          newTotalQuantity: inventory.totalQuantity.toNumber() + dto.quantity,
          lot: {
            lotNumber: lot.lotNumber,
            receivedAt: lot.receivedAt.toISOString()
          }
        }
      };

    } else {
      // SUBTRACT - use FIFO to deduct from oldest lots
      let remaining = dto.quantity;
      const allocations = [];

      const lots = await tx.inventoryLot.findMany({
        where: {
          itemId: dto.itemId,
          branchId: dto.branchId,
          currentQuantity: { gt: 0 },
          status: 'available'
        },
        orderBy: { receivedAt: 'asc' }
      });

      for (const lot of lots) {
        if (remaining <= 0) break;

        const deductQty = Math.min(lot.currentQuantity.toNumber(), remaining);
        
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: {
            currentQuantity: { decrement: deductQty },
            status: lot.currentQuantity.toNumber() - deductQty <= 0 ? 'depleted' : 'available'
          }
        });

        await tx.stockMovement.create({
          data: {
            lotId: lot.id,
            movementType: 'adjustment',
            quantity: -deductQty,
            referenceType: 'Adjustment',
            reason: dto.reason,
            userId,
            branchId: dto.branchId
          }
        });

        allocations.push({
          lotId: lot.id,
          quantity: deductQty,
          costPerUnit: lot.costPerUnit
        });

        remaining -= deductQty;
      }

      if (remaining > 0) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Not enough inventory to subtract',
          messageAr: 'المخزون غير كافٍ للخصم'
        });
      }

      // Update inventory total
      const newTotal = inventory.totalQuantity.toNumber() - dto.quantity;
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { totalQuantity: newTotal }
      });

      // Create journal entry for loss
      const totalCost = allocations.reduce(
        (sum, a) => sum + (a.quantity * a.costPerUnit), 
        0
      );
      await createAdjustmentJournalEntry(tx, {
        type: 'subtract',
        itemId: dto.itemId,
        quantity: dto.quantity,
        totalCost,
        reason: dto.reason
      });

      return {
        adjustment: {
          id: 0,
          type: 'subtract',
          itemName: item.name,
          quantity: dto.quantity,
          reason: dto.reason,
          newTotalQuantity: newTotal,
          allocations
        }
      };
    }
  });
}
```

#### Accounting Impact

**Add Adjustment:**
```
DR: Inventory                    (cost × quantity)
CR: Inventory Adjustment Income  (cost × quantity)
```

**Subtract Adjustment:**
```
DR: Inventory Loss/Shrinkage Expense  (FIFO cost)
CR: Inventory                         (FIFO cost)
```

---

### 4.5 Transfer Stock (Product Transformation)

```http
POST /inventory/transfer
```

**Access**: 🔒 Admin only

#### Purpose
Transform one product into another (e.g., whole chicken → chicken breasts).

#### Request Body

```typescript
{
  fromLotId: number;        // Source lot
  toItemId: number;         // Destination product
  quantity: number;         // Amount to transfer
  branchId: number;
  reason: string;
}
```

#### Response (Success - 201)

```typescript
{
  transfer: {
    id: 25,
    fromItem: {
      name: "دجاج كامل",
      lotNumber: "LOT-20260206-001",
      quantityDeducted: 10.000,
      remainingQuantity: 10.000
    },
    toItem: {
      name: "صدور دجاج",
      lotNumber: "TRF-20260208-001",
      quantityAdded: 10.000,
      costPerUnit: 5000         // Inherited from source
    }
  },
  message: "Stock transferred successfully",
  messageAr: "تم نقل المخزون بنجاح"
}
```

#### Business Logic

```typescript
async transferStock(dto: TransferStockDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate source lot
    const sourceLot = await tx.inventoryLot.findUnique({
      where: { id: dto.fromLotId },
      include: { item: true }
    });

    if (!sourceLot) {
      throw new NotFoundException('Source lot not found');
    }

    if (sourceLot.currentQuantity.toNumber() < dto.quantity) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient quantity in source lot',
        messageAr: 'الكمية غير كافية في الدفعة المصدر'
      });
    }

    // 2. Validate destination item
    const destItem = await tx.item.findUnique({
      where: { id: dto.toItemId }
    });

    if (!destItem) {
      throw new NotFoundException('Destination item not found');
    }

    // 3. Deduct from source lot
    await tx.inventoryLot.update({
      where: { id: sourceLot.id },
      data: {
        currentQuantity: { decrement: dto.quantity },
        status: sourceLot.currentQuantity.toNumber() - dto.quantity <= 0 
          ? 'transferred' 
          : 'available'
      }
    });

    // 4. Create destination lot (inherit cost from source)
    const destLotNumber = await generateLotNumber('TRF');
    const destLot = await tx.inventoryLot.create({
      data: {
        lotNumber: destLotNumber,
        itemId: dto.toItemId,
        branchId: dto.branchId,
        supplierId: sourceLot.supplierId,
        receivedAt: new Date(),
        expiryDate: sourceLot.expiryDate,  // Inherit expiry
        initialQuantity: dto.quantity,
        currentQuantity: dto.quantity,
        costPerUnit: sourceLot.costPerUnit,  // Inherit cost
        status: 'available'
      }
    });

    // 5. Create stock movements
    await tx.stockMovement.create({
      data: {
        lotId: sourceLot.id,
        movementType: 'transfer',
        quantity: -dto.quantity,
        referenceType: 'Transfer',
        reason: dto.reason,
        userId,
        branchId: dto.branchId
      }
    });

    await tx.stockMovement.create({
      data: {
        lotId: destLot.id,
        movementType: 'transfer',
        quantity: dto.quantity,
        referenceType: 'Transfer',
        reason: dto.reason,
        userId,
        branchId: dto.branchId
      }
    });

    // 6. Update inventory totals
    await updateInventoryTotal(tx, sourceLot.itemId, dto.branchId, -dto.quantity);
    await updateInventoryTotal(tx, dto.toItemId, dto.branchId, dto.quantity);

    // No accounting entry needed - inventory to inventory at same value

    return {
      transfer: {
        id: destLot.id,
        fromItem: {
          name: sourceLot.item.name,
          lotNumber: sourceLot.lotNumber,
          quantityDeducted: dto.quantity,
          remainingQuantity: sourceLot.currentQuantity.toNumber() - dto.quantity
        },
        toItem: {
          name: destItem.name,
          lotNumber: destLotNumber,
          quantityAdded: dto.quantity,
          costPerUnit: sourceLot.costPerUnit
        }
      }
    };
  });
}
```

---

### 4.6 Get Low Stock Items

```http
GET /inventory/low-stock?branchId=1
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  items: [
    {
      itemId: 15,
      itemCode: "BEEF-001",
      itemName: "لحم بقري",
      branchName: "الفرع الرئيسي",
      currentQuantity: 15.000,
      minStockLevel: 25.000,
      shortfall: 10.000,
      reorderSuggested: true
    }
  ],
  totalItems: 3
}
```

---

### 4.7 Get Expiring Batches

```http
GET /inventory/expiring?branchId=1&days=7
```

**Access**: 🔒 Admin, Cashier

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `branchId` | number | Filter by branch |
| `days` | number | Days until expiry (default: 7) |

#### Response (Success - 200)

```typescript
{
  batches: [
    {
      lotId: 101,
      lotNumber: "LOT-20260206-001",
      itemId: 10,
      itemName: "دجاج كامل",
      branchName: "الفرع الرئيسي",
      currentQuantity: 20.000,
      expiryDate: "2026-02-13T00:00:00Z",
      daysUntilExpiry: 5,
      status: "expiring_soon",
      estimatedValue: 100000    // Cost value (minor units)
    }
  ],
  totalBatches: 5,
  totalValue: 450000
}
```

---

### 4.8 Get Stock Movements

```http
GET /inventory/movements?lotId=101&from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lotId` | number | Filter by specific lot |
| `itemId` | number | Filter by item |
| `branchId` | number | Filter by branch |
| `movementType` | string | Filter by type |
| `from` | date | Start date |
| `to` | date | End date |

#### Response (Success - 200)

```typescript
{
  movements: [
    {
      id: 500,
      lotNumber: "LOT-20260206-001",
      itemName: "دجاج كامل",
      movementType: "purchase",
      quantity: 100.000,
      balanceAfter: 100.000,
      referenceType: "Purchase",
      referenceId: 15,
      referenceNumber: "PUR-0015",
      reason: null,
      userName: "admin",
      branchName: "الفرع الرئيسي",
      timestamp: "2026-02-06T08:00:00Z"
    },
    {
      id: 501,
      lotNumber: "LOT-20260206-001",
      itemName: "دجاج كامل",
      movementType: "sale",
      quantity: -25.000,
      balanceAfter: 75.000,
      referenceType: "Sale",
      referenceId: 42,
      referenceNumber: "SAL-0042",
      reason: null,
      userName: "cashier1",
      branchName: "الفرع الرئيسي",
      timestamp: "2026-02-06T10:30:00Z"
    }
  ],
  pagination: { ... }
}
```

---

## Helper Functions

### Generate Lot Number

```typescript
async function generateLotNumber(prefix: string = 'LOT'): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get today's count
  const countToday = await prisma.inventoryLot.count({
    where: {
      lotNumber: { startsWith: `${prefix}-${dateStr}` }
    }
  });
  
  const seq = (countToday + 1).toString().padStart(3, '0');
  return `${prefix}-${dateStr}-${seq}`;
}
// Result: LOT-20260208-001, LOT-20260208-002, etc.
```

### Calculate FIFO Cost

```typescript
function calculateFIFOCost(
  lots: InventoryLot[], 
  quantity: number
): { allocations: CostAllocation[], totalCost: number } {
  const allocations: CostAllocation[] = [];
  let remaining = quantity;
  let totalCost = 0;

  for (const lot of lots) {  // Already ordered by receivedAt ASC
    if (remaining <= 0) break;
    
    const allocQty = Math.min(lot.currentQuantity.toNumber(), remaining);
    const cost = allocQty * lot.costPerUnit;
    
    allocations.push({
      lotId: lot.id,
      quantity: allocQty,
      costPerUnit: lot.costPerUnit,
      cost
    });
    
    totalCost += cost;
    remaining -= allocQty;
  }

  if (remaining > 0) {
    throw new Error('Insufficient stock for FIFO calculation');
  }

  return { allocations, totalCost };
}
```

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `GET /inventory` | 📋 To Implement | inventory.controller.ts |
| `GET /inventory/items/:itemId` | 📋 To Implement | inventory.controller.ts |
| `POST /inventory/check-availability` | 📋 To Implement | inventory.controller.ts |
| `POST /inventory/adjust` | 📋 To Implement | inventory.controller.ts |
| `POST /inventory/transfer` | 📋 To Implement | inventory.controller.ts |
| `GET /inventory/low-stock` | 📋 To Implement | inventory.controller.ts |
| `GET /inventory/expiring` | 📋 To Implement | inventory.controller.ts |
| `GET /inventory/movements` | 📋 To Implement | inventory.controller.ts |
