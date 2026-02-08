# Product Requirements Document (PRD)
## نظام نقطة البيع والمخزون والمحاسبة لمتجر الدجاج
### Chicken Shop POS, Inventory & Accounting System

---

**Document Version:** 2.0  
**Last Updated:** February 6, 2026  
**Status:** Implementation Ready - Specialized for Chicken Shop

---

## 📋 Document Overview

This PRD is **specifically designed for chicken retail shops (محلات الدجاج / الفروج)** with the following key characteristics:

### ✅ Chicken Shop Specific Features:
- **Weight-based selling ONLY** (all products sold by kg, no piece/unit selling)
- **Digital scale integration** (required, auto-read weights)
- **Live bird purchase tracking** (gross weight, net weight, shrinkage %, real cost/kg)
- **Daily wastage management** (spoilage, trimming, expiry)
- **Shelf life tracking** (2 days fresh, 90 days frozen)
- **Arabic-first interface** (RTL support, primary language)
- **Two roles only:** Admin (full access) and Cashier (limited access)

### 🔧 System Characteristics:
- Single database (no multi-tenant complexity)
- FIFO inventory costing (fixed, not configurable)
- Weight unit: kg (fixed, not configurable)
- Offline-first capability
- Complete double-entry accounting system (retained)
- All reports included (retained)

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration Model](#configuration-model)
3. [Roles & Permissions](#roles--permissions)
4. [Domain Model (Data Schema)](#domain-model-data-schema)
5. [Core Workflows](#core-workflows)
6. [Accounting & Ledger Logic](#accounting--ledger-logic)
7. [UI/UX Requirements](#uiux-requirements)
8. [Reporting](#reporting)
9. [Integrations & Imports/Exports](#integrations--importsexports)
10. [Non-Functional Requirements](#non-functional-requirements)
11. [Acceptance Criteria](#acceptance-criteria)

---

## 1. Overview

### 1.1 Problem Statement

Chicken retail shops (محلات الدجاج / الفروج) require specialized systems that handle:
- Point of sale with weight-based selling (all products sold by kg)
- Real-time inventory tracking with FIFO costing
- Live bird purchase tracking (gross weight, net weight, shrinkage calculation)
- Supplier and customer credit management
- Automated accounting with double-entry ledger
- Waste/shrinkage/spoilage tracking (critical for perishable chicken)
- Arabic/RTL support for Middle Eastern markets
- Digital scale integration for accurate weighing

Existing solutions are either:
- Too generic (missing chicken shop specific workflows like live bird tracking)
- Too expensive (enterprise ERPs)
- Lacking offline-first capabilities
- Not supporting Arabic language properly

### 1.2 Goals

**Primary Goals:**
1. Create a specialized system for chicken retail shops (محلات الدجاج)
2. Support weight-based selling exclusively (all products sold by kg)
3. Track live bird purchases with shrinkage calculation (gross vs net weight)
4. Automate accounting with FIFO cost allocation
5. Manage waste and spoilage tracking (critical for perishable chicken)
6. Enable multi-branch operations (if shop expands)
7. Provide offline-first capabilities for unstable connectivity
8. Support Arabic/RTL as primary language with English secondary
9. Integrate with digital scales for accurate weighing

**Non-Goals:**
- Full ERP features (HR, manufacturing, fixed assets)
- E-commerce/online ordering
- Government tax filing automation
- Multi-currency support (single currency: SAR, USD, etc.)
- Selling by piece/unit (all sales by weight only)

### 1.3 Target Users

| Role | Responsibilities | System Access Level |
|------|------------------|---------------------|
| **Owner/Administrator (مالك/مدير)** | Business oversight, financial analysis, system configuration, approvals, all operations | Full access to all modules |
| **Cashier (كاشير)** | POS operations, customer service, daily sales, receiving payments, basic reports | Sales, customers, limited reports, no configuration access |

### 1.4 Key Assumptions

- Single currency (configurable: SAR, USD, AED, IQD, etc.)
- Fiscal year = calendar year (configurable)
- Inventory valuation: FIFO (First In, First Out)
- All products sold by weight (kg) - no piece/unit selling
- Businesses operate primarily with cash, some credit sales/purchases
- Hardware: Thermal printers, barcode scanners, **digital weighing scales (required)**
- Internet: Intermittent connectivity expected, offline-first design
- Language: Arabic-first (primary) with English fallback
- Single shop initially, scalable to multiple branches
- Fresh chicken shelf life: 1-2 days (requires daily waste monitoring)
- Frozen chicken shelf life: 30-90 days
- Live bird shrinkage: 20-30% average (configurable)

---

## 2. Configuration Model

### 2.1 System Configuration

**System Settings (Key-Value Store)**

| Key | Value Example | Description |
|-----|---------------|-------------|
| `BusinessName` | "الفروج الذهبي" | Display name (Arabic) |
| `BusinessNameEn` | "Golden Chicken" | Display name (English) |
| `Logo` | Base64 or URL | Business logo |
| `Currency` | "SAR", "USD", "AED" | Currency code |
| `CurrencySymbol` | "ر.س", "$" | Symbol for display |
| `TaxEnabled` | "true", "false" | Enable VAT/tax |
| `TaxRate` | "15" | Default tax % |
| `TaxLabel` | "ضريبة القيمة المضافة" | Tax display label |
| `WeightUnit` | "kg" (fixed) | Primary weight unit (always kg) |
| `Language` | "ar", "en" | Default UI language |
| `FiscalYearStart` | "01-01" | Fiscal year start (MM-DD) |
| `AutoDebtCreation` | "true" | Auto-create debts for unpaid sales/purchases |
| `AllowNegativeStock` | "false" | Allow sales with insufficient stock |
| `InventoryMethod` | "FIFO" (fixed) | Cost allocation method |
| `SaleNumberPrefix` | "SAL-" | Sales invoice prefix |
| `PurchaseNumberPrefix` | "PUR-" | Purchase order prefix |
| `FreshChickenShelfLife` | "2" | Days until fresh chicken expires |
| `FrozenChickenShelfLife` | "90" | Days until frozen chicken expires |
| `DefaultShrinkagePercentage` | "25" | Default live bird shrinkage % |
| `ScaleComPort` | "COM3" | Serial port for digital scale |
| `ScaleBaudRate` | "9600" | Baud rate for scale communication |
| `RequireScaleReading` | "true" | Require scale reading for weight-based sales |

**Branch/Outlet Configuration:**

```
Branch
├── Id (Guid, PK)
├── Name (string) - e.g., "الفرع الرئيسي", "فرع الشمال"
├── Code (string, unique) - e.g., "BR001"
├── Address (string)
├── Phone (string)
├── IsMainBranch (bool)
├── IsActive (bool)
├── HasScale (bool) - Does this branch have weighing scale
├── ScaleComPort (string?) - Serial port for scale at this branch
├── CreatedAt, UpdatedAt
```

**Chicken Shop Specific Configuration:**

```json
{
  "productCategories": [
    {
      "code": "FRESH_WHOLE",
      "label_ar": "دجاج طازج كامل",
      "label_en": "Fresh Whole Chicken",
      "defaultShelfLife": 2
    },
    {
      "code": "FRESH_PARTS",
      "label_ar": "قطع دجاج طازج",
      "label_en": "Fresh Chicken Parts",
      "defaultShelfLife": 2,
      "subCategories": ["صدور", "أفخاذ", "أجنحة", "كبد", "قوانص", "رقبة"]
    },
    {
      "code": "FROZEN_WHOLE",
      "label_ar": "دجاج مجمد كامل",
      "label_en": "Frozen Whole Chicken",
      "defaultShelfLife": 90
    },
    {
      "code": "FROZEN_PARTS",
      "label_ar": "قطع دجاج مجمد",
      "label_en": "Frozen Chicken Parts",
      "defaultShelfLife": 90
    },
    {
      "code": "PROCESSED",
      "label_ar": "دجاج معالج",
      "label_en": "Processed Chicken",
      "defaultShelfLife": 7,
      "examples": ["دجاج مشوي", "دجاج متبل"]
    },
    {
      "code": "EXTRAS",
      "label_ar": "إضافات",
      "label_en": "Extras",
      "examples": ["أكياس", "توابل"]
    }
  ],
  "features": {
    "weightBasedSellingOnly": true,
    "scaleIntegrationRequired": true,
    "wastageTrackingEnabled": true,
    "liveBirdTrackingEnabled": true,
    "dailyExpiryAlertsEnabled": true,
    "shrinkageCalculationEnabled": true
  },
  "businessRules": {
    "requireWeightForAllSales": true,
    "allowPieceSelling": false,
    "trackLiveBirdPurchases": true,
    "calculateShrinkagePercentage": true,
    "dailyWasteReportRequired": true
  }
}
```

---

## 3. Roles & Permissions

### 3.1 Role Definitions

Simple role-based access with two main roles:

```
Role
├── Id (Guid, PK)
├── Name (string, unique)
├── NameAr (string) - Arabic name
├── Description (string)
├── IsSystemRole (bool, cannot be deleted)
├── Permissions (string[], JSON array)
├── CreatedAt, UpdatedAt
```

```
UserRole (many-to-many)
├── UserId (Guid, FK)
├── RoleId (Guid, FK)
└── AssignedAt (DateTime)
```

**System Roles:**

| Role | Code | Arabic Name | Description |
|------|------|-------------|-------------|
| Administrator | `admin` | مدير / مالك | Full system access: sales, purchases, inventory, customers, suppliers, expenses, reports, settings, user management, approvals |
| Cashier | `cashier` | كاشير / بائع | Limited access: POS operations, sales, customer queries, receive payments, basic reports only. Cannot access purchases, expenses, settings, or sensitive financial reports |

### 3.2 Permission Matrix

**Permission Format:** `{module}.{action}`

| Permission | Admin | Cashier | Notes |
|------------|-------|---------|-------|
| **Sales (المبيعات)** |
| `sales.create` | ✓ | ✓ | Both can create sales |
| `sales.view` | ✓ | ✓ (own only) | Cashier sees only their sales |
| `sales.edit` | ✓ | ✗ | Only admin can edit |
| `sales.delete` | ✓ | ✗ | Only admin can delete |
| `sales.void` | ✓ | ✗ | Only admin can void with reason |
| `sales.discount.apply` | ✓ | Limited (5% max) | Cashier limited discount |
| **Purchases (المشتريات)** |
| `purchases.create` | ✓ | ✗ | Only admin |
| `purchases.view` | ✓ | ✗ | Only admin |
| `purchases.receive` | ✓ | ✗ | Only admin receives goods |
| `purchases.liveBird` | ✓ | ✗ | Only admin tracks live birds |
| **Inventory (المخزون)** |
| `inventory.view` | ✓ | ✓ (basic) | Cashier sees stock levels only |
| `inventory.adjust` | ✓ | ✗ | Only admin |
| `inventory.transfer` | ✓ | ✗ | Only admin |
| `inventory.waste` | ✓ | ✗ | Only admin records waste |
| **Customers (العملاء)** |
| `customers.create` | ✓ | ✓ | Both can add customers |
| `customers.view` | ✓ | ✓ | Both can view |
| `customers.edit` | ✓ | ✗ | Only admin edits |
| `customers.creditLimit` | ✓ | ✗ | Only admin sets credit limits |
| **Suppliers (الموردين)** |
| `suppliers.manage` | ✓ | ✗ | Only admin |
| **Payments (المدفوعات)** |
| `payments.receive` | ✓ | ✓ | Both receive customer payments |
| `payments.make` | ✓ | ✗ | Only admin pays suppliers |
| **Expenses (المصروفات)** |
| `expenses.create` | ✓ | ✗ | Only admin |
| `expenses.view` | ✓ | ✗ | Only admin |
| **Reports (التقارير)** |
| `reports.dailySales` | ✓ | ✓ (own only) | Cashier sees own sales |
| `reports.profit` | ✓ | ✗ | Only admin |
| `reports.inventory` | ✓ | ✗ | Only admin |
| `reports.wastage` | ✓ | ✗ | Only admin |
| `reports.financial` | ✓ | ✗ | Only admin |
| **System (النظام)** |
| `system.settings` | ✓ | ✗ | Only admin |
| `system.users` | ✓ | ✗ | Only admin |
| `system.backup` | ✓ | ✗ | Only admin |
| `system.branches` | ✓ | ✗ | Only admin |

---

## 4. Domain Model (Data Schema)

### 4.1 Base Entity Pattern

All entities inherit from `BaseEntity` (adopt from cars project):

```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
}
```

### 4.2 Core Entities

#### 4.2.1 Product/Item Management

**Item** (Chicken product master)

```
Item : BaseEntity
├── Code (string, unique, indexed) - SKU/Product code (e.g., "CH-WHOLE-001")
├── Barcode (string?, indexed) - Barcode for scanning
├── Name (string) - Product name (e.g., "دجاج كامل طازج")
├── NameAr (string) - Arabic name (primary)
├── NameEn (string?) - English name (secondary)
├── Description (string?)
├── CategoryId (Guid, FK → Category)
├── WeightUnit (fixed: "kg") - All products sold by kg
├── DefaultSalePricePerKg (decimal) - Price per kg
├── DefaultPurchasePricePerKg (decimal) - Cost per kg
├── IsActive (bool)
├── MinStockLevel (decimal?) - Low stock alert threshold (in kg)
├── MaxStockLevel (decimal?) - Overstock alert (in kg)
├── StorageLocation (enum: Fridge, Freezer, Display) - Where stored
├── ImageUrl (string?)
├── TaxRate (decimal?) - Override default tax rate
├── AllowNegativeStock (bool) - Override system setting
├── ShelfLifeDays (int?) - Days until expiry (e.g., 2 for fresh, 90 for frozen)
├── RequiresScale (bool, default: true) - Must use scale for selling
└── Metadata (JSON?) - Chicken-specific fields
```

**Category**

```
Category : BaseEntity
├── Code (string, unique) - e.g., "FRESH_WHOLE", "FRESH_PARTS"
├── Name (string) - e.g., "Fresh Chicken Parts"
├── NameAr (string) - e.g., "قطع دجاج طازج" (primary)
├── NameEn (string?) - English name
├── DisplayOrder (int) - Order in UI
├── IsActive (bool)
├── Icon (string?) - UI icon identifier
├── DefaultShelfLife (int?) - Default days until expiry
└── StorageType (enum: Fresh, Frozen, Processed) - Storage category
```

**Fixed Categories for Chicken Shop:**

| Code | Name (Arabic) | Name (English) | Shelf Life | Storage |
|------|---------------|----------------|------------|---------|
| `FRESH_WHOLE` | دجاج طازج كامل | Fresh Whole Chicken | 2 days | Fresh |
| `FRESH_PARTS` | قطع دجاج طازج | Fresh Chicken Parts | 2 days | Fresh |
| `FROZEN_WHOLE` | دجاج مجمد كامل | Frozen Whole Chicken | 90 days | Frozen |
| `FROZEN_PARTS` | قطع دجاج مجمد | Frozen Chicken Parts | 90 days | Frozen |
| `PROCESSED` | دجاج معالج | Processed Chicken | 7 days | Fresh |
| `EXTRAS` | إضافات | Extras | N/A | N/A |

**Item Metadata Example (JSON):**
```json
{
  "isLiveBird": false,
  "chickenPart": "breast|thigh|wing|liver|gizzard|whole",
  "averageWeightPerPiece": 1.5,
  "supplier": "مزرعة الخير",
  "notes": "صدور دجاج بدون جلد"
}
```

#### 4.2.2 Inventory Management

**Inventory** (Current stock - from cars project)

```
Inventory : BaseEntity
├── ItemId (Guid, FK, unique)
├── CurrentQuantity (decimal) - Sum of all lot remaining quantities
├── ReservedQuantity (decimal) - Allocated to pending orders
├── AvailableQuantity (decimal, computed) - Current - Reserved
├── TotalValue (decimal, computed) - Sum of lot values
├── AverageCost (decimal, computed) - Weighted average
├── LastRestockedAt (DateTime?)
└── LastSoldAt (DateTime?)
```

**InventoryLot** (FIFO lot tracking - from cars project)

```
InventoryLot : BaseEntity
├── ItemId (Guid, FK, indexed)
├── LotNumber (string, unique) - Generated or supplier lot#
├── PurchaseId (Guid?, FK → Purchase)
├── PurchaseLineId (Guid?, FK → PurchaseLine)
├── TotalQuantity (decimal) - Original quantity received
├── RemainingQuantity (decimal) - Not yet allocated to sales
├── UnitPurchasePrice (decimal) - Cost per unit for this lot
├── ReceivedAt (DateTime, indexed) - For FIFO ordering
├── ExpiryDate (DateTime?) - For perishables
├── BatchNumber (string?) - Supplier batch
├── BranchId (Guid?, FK) - Multi-location
└── Metadata (JSON?) - e.g., live bird weight tracking
```

**StockMovement** (Audit trail - from cars project)

```
StockMovement : BaseEntity
├── ItemId (Guid, FK, indexed)
├── LotId (Guid?, FK)
├── MovementType (enum: Purchase, Sale, Adjustment, Transfer, Waste, Opening)
├── Quantity (decimal) - Positive = in, Negative = out
├── UnitCost (decimal?)
├── ReferenceType (string?) - "Sale", "Purchase", "Adjustment"
├── ReferenceId (Guid?) - ID of related transaction
├── FromBranchId (Guid?, FK) - For transfers
├── ToBranchId (Guid?, FK)
├── Reason (string?) - For adjustments/waste
├── PerformedBy (Guid, FK → User)
└── MovementDate (DateTime, indexed)
```

**WastageRecord** (Critical for chicken shop - daily tracking required)

```
WastageRecord : BaseEntity
├── ItemId (Guid, FK, indexed)
├── LotId (Guid?, FK)
├── WeightKg (decimal) - Weight of wasted chicken in kg
├── WastageType (enum: Spoilage, Trimming, Expired, Damaged, EndOfDay, Other)
├── Reason (string, required) - e.g., "تلف بسبب انقطاع التبريد"
├── EstimatedCostValue (decimal) - Cost value of waste (from FIFO)
├── RecordedBy (Guid, FK → User) - Usually admin
├── ApprovedBy (Guid?, FK → User) - Admin approval
├── WastageDate (DateTime, indexed)
├── BranchId (Guid?, FK)
├── PhotoUrl (string?) - Photo evidence of waste
└── Notes (string?) - Additional details
```

**Wastage Types:**
- **Spoilage (تلف)**: Chicken went bad due to temperature, time
- **Trimming (تشذيب)**: Normal trimming/cleaning loss
- **Expired (منتهي الصلاحية)**: Past shelf life
- **Damaged (تالف)**: Physical damage
- **EndOfDay (آخر اليوم)**: Unsold fresh chicken at end of day
- **Other (أخرى)**: Other reasons

**Notes:**
- Daily wastage reports required for fresh chicken
- Waste tracked by weight (kg)
- Cost calculated from FIFO lot allocation
- Photo evidence optional but recommended

#### 4.2.3 Sales

**Sale** (Generalized from cars project `Sale`)

```
Sale : BaseEntity
├── SaleNumber (string, unique, indexed) - Auto-generated: SAL-000001
├── SaleDate (DateTime, indexed)
├── SaleType (enum: Cash, Credit, Mixed) - Payment type
├── CustomerId (Guid?, FK, indexed) - Null for walk-in
├── CustomerName (string?) - Cached from Customer or manual
├── CustomerPhone (string?)
├── CashierId (Guid, FK → User)
├── BranchId (Guid?, FK)
├── GrossTotalAmount (decimal) - Before discount
├── DiscountAmount (decimal)
├── DiscountPercentage (decimal?)
├── TaxAmount (decimal) - Calculated VAT/tax
├── TotalAmount (decimal) - Final amount (Gross - Discount + Tax)
├── TotalCost (decimal) - Sum of FIFO cost allocations
├── TotalProfit (decimal, computed) - TotalAmount - TotalCost
├── PaymentStatus (enum: Unpaid, PartiallyPaid, Paid)
├── AmountPaid (decimal) - Sum of payments
├── AmountDue (decimal, computed) - TotalAmount - AmountPaid
├── DueDate (DateTime?) - For credit sales
├── Notes (string?)
├── IsVoided (bool)
├── VoidedAt (DateTime?)
├── VoidedBy (Guid?, FK → User)
├── VoidReason (string?)
└── Metadata (JSON?) - e.g., scale readings, receipt print count
```

**SaleLine**

```
SaleLine : BaseEntity
├── SaleId (Guid, FK, indexed)
├── LineNumber (int) - Order in invoice
├── ItemId (Guid, FK)
├── ItemName (string) - Cached (Arabic)
├── ItemCode (string) - Cached
├── WeightKg (decimal) - Weight in kg (from scale)
├── PricePerKg (decimal) - Gross price per kg
├── DiscountAmount (decimal) - Line-level discount
├── NetPricePerKg (decimal) - After discount
├── TaxRate (decimal)
├── TaxAmount (decimal)
├── LineTotalAmount (decimal) - WeightKg * NetPricePerKg + TaxAmount
├── CostPerKg (decimal) - Weighted avg from lot allocations
├── LineTotalCost (decimal) - Sum of cost allocations (FIFO)
├── LineProfit (decimal, computed) - LineTotalAmount - LineTotalCost
└── Metadata (JSON?) - e.g., {"scaleReading": "1.523", "manualEntry": false}
```

**Notes:**
- All sales are weight-based (kg only)
- `WeightKg` must be > 0
- Scale reading stored in Metadata for audit

**SaleLineCostAllocation** (FIFO cost tracking - from cars project)

```
SaleLineCostAllocation : BaseEntity
├── SaleLineId (Guid, FK, indexed)
├── LotId (Guid, FK, indexed)
├── QuantityAllocated (decimal) - Quantity consumed from this lot
├── UnitCost (decimal) - Lot's unit purchase price
└── TotalCost (decimal, computed) - QuantityAllocated * UnitCost
```

**SalesProfit** (Aggregate profit - from cars project, optional)

```
SalesProfit
├── Id (Guid, PK)
├── TotalProfit (decimal) - Aggregated across all sales
└── LastUpdated (DateTime)
```

#### 4.2.4 Purchases

**Purchase** (Generalized from cars project)

```
Purchase : BaseEntity
├── PurchaseNumber (string, unique, indexed)
├── PurchaseDate (DateTime, indexed)
├── SupplierId (Guid, FK, indexed) - Previously "MerchantId"
├── SupplierName (string) - Cached
├── SupplierInvoiceNumber (string?) - Supplier's invoice reference
├── TotalAmount (decimal)
├── TaxAmount (decimal)
├── PaymentStatus (enum: Unpaid, PartiallyPaid, Paid)
├── AmountPaid (decimal)
├── AmountDue (decimal, computed)
├── DueDate (DateTime?)
├── ReceivedBy (Guid?, FK → User)
├── ReceivedAt (DateTime?) - Goods received timestamp
├── BranchId (Guid?, FK)
├── Notes (string?)
├── IsApproved (bool) - Manager approval
├── ApprovedBy (Guid?, FK → User)
├── ApprovedAt (DateTime?)
└── Metadata (JSON?) - e.g., live bird weight details
```

**PurchaseLine**

```
PurchaseLine : BaseEntity
├── PurchaseId (Guid, FK, indexed)
├── LineNumber (int)
├── ItemId (Guid, FK)
├── ItemName (string) - Cached (Arabic)
├── ItemCode (string)
├── WeightKg (decimal) - Weight in kg
├── PricePerKg (decimal) - Purchase price per kg
├── TaxRate (decimal)
├── TaxAmount (decimal)
├── LineTotalAmount (decimal)
├── LotNumber (string?) - Assigned on receiving
├── ExpiryDate (DateTime?) - Calculated based on shelf life
├── IsLiveBird (bool) - If this is live bird purchase
└── Metadata (JSON?) - Live bird tracking details
```

**Live Bird Purchase Metadata Example:**
```json
{
  "isLiveBird": true,
  "grossLiveWeightKg": 100.5,
  "netUsableWeightKg": 75.2,
  "shrinkagePercentage": 25.15,
  "realCostPerKg": 8.67,
  "numberOfBirds": 50,
  "averageWeightPerBird": 2.01,
  "processingDate": "2026-02-05T10:30:00Z",
  "processingNotes": "تشذيب عادي"
}
```

**Notes:**
- All purchases by weight (kg)
- If `IsLiveBird = true`, track gross and net weights
- Real cost per kg = Line Total / Net Weight

#### 4.2.5 Payments & Debts

**Payment** (Generic payment - from cars project)

```
Payment : BaseEntity
├── PaymentNumber (string, unique)
├── PaymentDate (DateTime, indexed)
├── Amount (decimal)
├── PaymentMethod (enum: Cash, Card, BankTransfer, MobilePayment, Check)
├── ReferenceType (enum: Sale, Purchase, Expense, Debt, Salary)
├── ReferenceId (Guid) - ID of related entity
├── PayerId (Guid?, FK) - Customer/Supplier/Employee
├── PayerName (string?)
├── ReceivedBy (Guid?, FK → User)
├── BranchId (Guid?, FK)
├── Notes (string?)
├── ReceiptNumber (string?)
├── BankTransactionId (string?) - For electronic payments
└── IsVoided (bool)
```

**Debt** (Receivables/Payables - from cars project)

```
Debt : BaseEntity
├── DebtNumber (string, unique)
├── Direction (enum: OwedToMe, OwedByMe) - Receivable/Payable
├── PartyType (enum: Customer, Supplier, Employee, Other)
├── PartyId (Guid?) - CustomerId or SupplierId
├── PartyName (string)
├── TotalAmount (decimal)
├── AmountPaid (decimal)
├── AmountRemaining (decimal, computed)
├── DueDate (DateTime?, indexed)
├── SourceType (string) - "Sale", "Purchase", "Expense"
├── SourceId (Guid) - Reference to originating transaction
├── Status (enum: Open, PartiallyPaid, Paid, Overdue, Written Off)
├── Notes (string?)
└── BranchId (Guid?, FK)
```

#### 4.2.6 Parties (Customers, Suppliers)

**Customer** (From cars project)

```
Customer : BaseEntity
├── CustomerNumber (string, unique)
├── Name (string, indexed)
├── NameAr (string?)
├── Phone (string?, indexed)
├── Phone2 (string?)
├── Email (string?)
├── Address (string?)
├── CreditLimit (decimal) - Maximum outstanding balance
├── CurrentBalance (decimal, computed) - Sum of unpaid debts
├── PriceLevel (enum: Standard, Wholesale, VIP) - Discount tier
├── DefaultDiscountPercentage (decimal?)
├── TaxNumber (string?) - For VAT-registered customers
├── Notes (string?)
├── IsActive (bool)
└── Metadata (JSON?) - e.g., loyalty points
```

**Supplier** (Generalized from cars project `Merchant`)

```
Supplier : BaseEntity
├── SupplierNumber (string, unique)
├── Name (string, indexed)
├── NameAr (string?)
├── Phone (string?)
├── Email (string?)
├── Address (string?)
├── ContactPerson (string?)
├── TaxNumber (string?)
├── PaymentTerms (string?) - e.g., "Net 30", "Cash on delivery"
├── CurrentBalance (decimal, computed) - Amount we owe
├── CreditLimit (decimal?) - Our credit limit with them
├── BankAccountNumber (string?)
├── BankName (string?)
├── Notes (string?)
├── IsActive (bool)
└── Rating (int?) - Supplier performance rating
```

#### 4.2.7 Expenses

**Expense** (From cars project `PersonalExpense`, generalized)

```
Expense : BaseEntity
├── ExpenseNumber (string, unique)
├── ExpenseDate (DateTime, indexed)
├── ExpenseType (enum: Operational, Personal, Payroll, Utilities, Rent, Maintenance, Other)
├── CategoryId (Guid?, FK → ExpenseCategory)
├── Amount (decimal)
├── TaxAmount (decimal?)
├── Description (string, required)
├── SupplierId (Guid?, FK) - If paid to supplier
├── PaymentMethod (enum)
├── ReferenceNumber (string?) - Invoice/receipt number
├── IsApproved (bool)
├── ApprovedBy (Guid?, FK → User)
├── ApprovedAt (DateTime?)
├── BranchId (Guid?, FK)
├── CreatedBy (Guid, FK → User)
├── AttachmentUrl (string?) - Receipt image
└── Notes (string?)
```

**ExpenseCategory**

```
ExpenseCategory : BaseEntity
├── Code (string, unique)
├── Name (string)
├── NameAr (string?)
├── AccountCode (string?) - Link to chart of accounts
├── IsActive (bool)
└── ParentCategoryId (Guid?, FK) - Hierarchical
```

#### 4.2.8 Users & Authentication

**User** (Extended from cars project)

```
User : BaseEntity
├── UserName (string, unique, indexed)
├── Email (string, unique, indexed)
├── PasswordHash (string)
├── FullName (string)
├── FullNameAr (string?)
├── Phone (string?)
├── EmployeeNumber (string?)
├── IsActive (bool)
├── LastLoginAt (DateTime?)
├── RefreshToken (string?)
├── RefreshTokenExpiresAt (DateTime?)
├── DefaultBranchId (Guid?, FK)
├── PreferredLanguage (enum: Arabic, English)
└── Metadata (JSON?) - UI preferences, cashier settings
```

**UserRole** (Many-to-many)

```
UserRole
├── UserId (Guid, FK)
├── RoleId (Guid, FK)
├── AssignedAt (DateTime)
└── AssignedBy (Guid, FK → User)
```

#### 4.2.9 System

**SystemSetting** (From cars project)

```
SystemSetting : BaseEntity
├── Key (string, unique, PK)
├── Value (string) - JSON serialized
├── Description (string?)
├── DataType (enum: String, Number, Boolean, JSON)
├── IsSystem (bool) - Cannot be deleted by users
└── Group (string?) - Grouping for UI (General, Tax, Numbering, etc.)
```

**AuditLog** (New - compliance requirement)

```
AuditLog
├── Id (Guid, PK)
├── Timestamp (DateTime, indexed)
├── UserId (Guid?, FK)
├── UserName (string)
├── Action (string) - "Create", "Update", "Delete", "Void"
├── EntityType (string) - "Sale", "Purchase", "Payment"
├── EntityId (Guid)
├── Changes (JSON) - Before/after values
├── IpAddress (string?)
├── UserAgent (string?)
└── BranchId (Guid?, FK)
```

### 4.3 Entity Relationships

```
Customer 1:N → Sale
Customer 1:N → Debt
Customer 1:N → Payment

Supplier 1:N → Purchase
Supplier 1:N → Debt
Supplier 1:N → Expense

Item 1:N → SaleLine
Item 1:N → PurchaseLine
Item 1:N → Inventory (1:1)
Item 1:N → InventoryLot
Item 1:N → StockMovement
Item 1:N → WastageRecord
Item N:1 → Category

Sale 1:N → SaleLine
Sale 1:N → Payment
Sale 1:1? → Debt

SaleLine 1:N → SaleLineCostAllocation
SaleLine N:1 → Item

Purchase 1:N → PurchaseLine
Purchase 1:N → Payment
Purchase 1:1? → Debt

PurchaseLine N:1 → Item
PurchaseLine 1:1? → InventoryLot

InventoryLot N:1 → Item
InventoryLot N:1? → Purchase
InventoryLot 1:N → SaleLineCostAllocation
InventoryLot 1:N → StockMovement

User 1:N → Sale (as Cashier)
User 1:N → Purchase (as ReceivedBy)
User 1:N → Expense
User N:M → Role (via UserRole)

Branch 1:N → Sale
Branch 1:N → Purchase
Branch 1:N → Inventory
Branch 1:N → StockMovement
```

### 4.4 Indexes

**Critical Indexes for Performance:**

```sql
-- Sales
CREATE INDEX IX_Sale_SaleDate ON Sale(SaleDate DESC);
CREATE INDEX IX_Sale_CustomerId ON Sale(CustomerId);
CREATE INDEX IX_Sale_SaleNumber ON Sale(SaleNumber);
CREATE INDEX IX_Sale_PaymentStatus ON Sale(PaymentStatus);

-- Purchases
CREATE INDEX IX_Purchase_PurchaseDate ON Purchase(PurchaseDate DESC);
CREATE INDEX IX_Purchase_SupplierId ON Purchase(SupplierId);

-- Inventory
CREATE INDEX IX_InventoryLot_ItemId_ReceivedAt ON InventoryLot(ItemId, ReceivedAt);
CREATE INDEX IX_InventoryLot_ExpiryDate ON InventoryLot(ExpiryDate) WHERE ExpiryDate IS NOT NULL;
CREATE INDEX IX_StockMovement_ItemId_MovementDate ON StockMovement(ItemId, MovementDate DESC);

-- Debts
CREATE INDEX IX_Debt_PartyId_Status ON Debt(PartyId, Status);
CREATE INDEX IX_Debt_DueDate ON Debt(DueDate) WHERE Status != 'Paid';

-- Audit
CREATE INDEX IX_AuditLog_Timestamp ON AuditLog(Timestamp DESC);
CREATE INDEX IX_AuditLog_EntityType_EntityId ON AuditLog(EntityType, EntityId);
```

---

## 5. Core Workflows

### 5.1 Procurement & Receiving Workflow

**Actors:** Purchaser, Manager (approval), System

**Steps:**

1. **Create Purchase Order**
   - Purchaser selects supplier
   - Adds line items (Item, Quantity, Unit Price)
   - System calculates tax and total
   - Save as draft or submit for approval

2. **Approval (if required)**
   - Manager reviews purchase order
   - Approves or rejects
   - System sets `IsApproved = true`, records `ApprovedBy` and `ApprovedAt`

3. **Goods Receiving**
   - Purchaser marks purchase as "Received"
   - For each line item:
     - Create `InventoryLot` with:
       - `TotalQuantity = Quantity`
       - `RemainingQuantity = Quantity`
       - `UnitPurchasePrice = UnitPurchasePrice`
       - `ReceivedAt = Now`
       - `LotNumber` = auto-generated or supplier-provided
     - Update `Inventory.CurrentQuantity += Quantity`
     - Create `StockMovement` (MovementType = Purchase, Quantity = +ve)

4. **Special: Live Bird Receiving (Critical for Chicken Shop)**
   
   **Step-by-step process:**
   
   a. **Initial Purchase Entry:**
   - Record purchase with `IsLiveBird = true`
   - Enter: Number of birds, Gross live weight (kg), Total price
   - Calculate initial price per kg (gross)
   
   b. **Processing Stage:**
   - Process birds (slaughter, clean, cut)
   - Weigh net usable meat weight (kg)
   
   c. **Final Calculation:**
   - **Shrinkage % = (Gross Weight - Net Weight) / Gross Weight × 100**
   - Example: (100.5 kg - 75.2 kg) / 100.5 kg × 100 = 25.15%
   - **Real Cost per Kg = Total Purchase Amount / Net Usable Weight**
   - Example: 650 SAR / 75.2 kg = 8.67 SAR/kg
   
   d. **System Updates:**
   - Create `InventoryLot` with:
     - `TotalQuantity = Net Usable Weight` (75.2 kg)
     - `RemainingQuantity = Net Usable Weight` (75.2 kg)
     - `UnitPurchasePrice = Real Cost per Kg` (8.67 SAR/kg)
   - Update `PurchaseLine.Metadata`:
     ```json
     {
       "isLiveBird": true,
       "grossLiveWeightKg": 100.5,
       "netUsableWeightKg": 75.2,
       "shrinkagePercentage": 25.15,
       "realCostPerKg": 8.67,
       "numberOfBirds": 50,
       "processingDate": "2026-02-05T10:30:00Z"
     }
     ```
   - Create `WastageRecord` for shrinkage:
     - `WeightKg = 25.3 kg` (shrinkage)
     - `WastageType = Trimming`
     - `EstimatedCostValue = 0` (not added to inventory cost)
     - `Reason = "Live bird processing shrinkage"`
   
   e. **Inventory Impact:**
   - Only net weight (75.2 kg) added to inventory
   - All future FIFO calculations use real cost per kg (8.67 SAR/kg)
   - Shrinkage tracked separately for reporting

5. **Payment (Full/Partial)**
   - Create `Payment` record:
     - `ReferenceType = Purchase`
     - `ReferenceId = PurchaseId`
   - Update `Purchase.AmountPaid += Payment.Amount`
   - Update `Purchase.PaymentStatus` (Unpaid → PartiallyPaid → Paid)

6. **Auto Debt Creation**
   - If `Purchase.AmountDue > 0` and `SystemSetting.AutoDebtCreation = true`:
     - Create `Debt`:
       - `Direction = OwedByMe`
       - `PartyType = Supplier`
       - `PartyId = SupplierId`
       - `TotalAmount = AmountDue`
       - `SourceType = "Purchase"`
       - `SourceId = PurchaseId`

**Edge Cases:**
- **Over-receiving:** Allow if supplier sent more than ordered (create adjustment)
- **Under-receiving:** Partial receive, keep purchase open
- **Quality rejection:** Create return/debit note (future feature)
- **Price variance:** Update lot cost if final invoice differs

---

### 5.2 Sales Workflow

**Actors:** Cashier, Customer, Manager (void approval), System

**Steps:**

1. **Initiate Sale**
   - Cashier selects or creates walk-in sale
   - Optionally select `Customer` for credit/tracking

2. **Add Line Items** (All weight-based)
   - For each item:
     - Select `Item` (chicken product)
     - **Place item on digital scale:**
       - System automatically reads weight (kg) via serial port
       - Display live weight reading: "1.523 kg"
       - Press "Add" when weight stabilizes
     - **Manual weight entry (if scale unavailable):**
       - Requires admin override password
       - Enter weight manually
       - Log in metadata: `{"manualEntry": true, "reason": "scale malfunction"}`
     - Display calculation:
       - Weight (kg) × Price per kg = Line Gross Total
       - Apply line-level discount if authorized
       - Add tax if applicable
     - Apply line-level discount if authorized (cashier: max 5%, admin: unlimited)
   - System calculates:
     - `GrossTotalAmount = Sum(Line Totals)`
     - `TaxAmount = GrossTotalAmount × TaxRate`
     - `TotalAmount = GrossTotalAmount - DiscountAmount + TaxAmount`

3. **Apply Discounts**
   - Cashier applies discount (% or fixed amount)
   - If discount > configured threshold → require manager approval
   - System recalculates `TotalAmount`

4. **Select Payment Type**
   - **Cash:** Full payment received
   - **Credit:** Customer pays later (requires Customer selection)
   - **Mixed:** Partial cash + credit

5. **Save & Process Sale**
   - Generate unique `SaleNumber` (e.g., SAL-000042)
   - For each `SaleLine`:
     - **FIFO Cost Allocation:**
       - Query `InventoryLot` WHERE `ItemId = Line.ItemId` AND `RemainingQuantity > 0` ORDER BY `ReceivedAt ASC`
       - Allocate line quantity across lots:
         ```
         remainingToAllocate = Line.Quantity
         while remainingToAllocate > 0:
             lot = next available lot (FIFO)
             allocate = min(remainingToAllocate, lot.RemainingQuantity)
             Create SaleLineCostAllocation:
                 QuantityAllocated = allocate
                 UnitCost = lot.UnitPurchasePrice
                 TotalCost = allocate × lot.UnitCost
             lot.RemainingQuantity -= allocate
             remainingToAllocate -= allocate
         ```
       - Update `SaleLine.LineTotalCost = Sum(Allocations.TotalCost)`
       - Update `SaleLine.UnitPurchasePrice = LineTotalCost / Quantity` (weighted avg)
     - Update `Inventory.CurrentQuantity -= Line.Quantity`
     - Create `StockMovement` (MovementType = Sale, Quantity = -ve)

6. **Calculate Profit**
   - For each line: `LineProfit = LineTotalAmount - LineTotalCost`
   - `Sale.TotalCost = Sum(SaleLine.LineTotalCost)`
   - `Sale.TotalProfit = TotalAmount - TotalCost`

7. **Handle Payment**
   - If Cash/Card:
     - Create `Payment` record
     - `Sale.AmountPaid = Payment.Amount`
     - `Sale.PaymentStatus = Paid`
   - If Credit:
     - `Sale.AmountPaid = 0`
     - `Sale.PaymentStatus = Unpaid`
     - Set `DueDate` (e.g., +30 days)

8. **Auto Debt Creation**
   - If `Sale.AmountDue > 0`:
     - Create `Debt`:
       - `Direction = OwedToMe`
       - `PartyType = Customer`
       - `PartyId = CustomerId`
       - `TotalAmount = AmountDue`

9. **Print Receipt**
   - Generate thermal printer receipt (Arabic/English)
   - Include: Business name, sale#, date, items, totals, payment, balance

**Edge Cases:**
- **Insufficient stock:**
  - If `SystemSetting.AllowNegativeStock = false` → Block sale, show alert: "مخزون غير كافٍ. المتوفر: 5.2 كجم، المطلوب: 10 كجم"
  - If `true` → Allow, create negative inventory (rare for fresh chicken)
- **Scale malfunction:** 
  - Manual weight entry with admin password override
  - Log in metadata: `{"manualEntry": true, "overrideBy": "admin_user_id"}`
  - Alert admin to fix scale
- **Scale reading unstable:**
  - Show warning: "الوزن غير مستقر - انتظر..."
  - Wait for stable reading (tolerance: ±0.01 kg for 2 seconds)
- **Price override:** 
  - Only admin can override price
  - Log reason in metadata
- **Customer credit limit exceeded:** 
  - Block sale with message: "تم تجاوز الحد الائتماني. الحد: 2000 ر.س، الرصيد الحالي: 1800 ر.س"
  - Admin can override with reason
- **Zero weight reading:**
  - Block sale, show error: "يرجى وضع المنتج على الميزان"
- **Expired product:**
  - Show warning if trying to sell expired lot: "تحذير: هذا المنتج منتهي الصلاحية"
  - Admin can override (for discounted sales or waste)

---

### 5.3 Returns & Voids

**Return/Void Sale:**

1. Manager locates sale by `SaleNumber` or customer
2. Select reason: Wrong item, Damaged, Customer dissatisfaction, Entry error
3. System marks `Sale.IsVoided = true`, records `VoidReason`, `VoidedBy`, `VoidedAt`
4. **Reverse inventory:**
   - For each `SaleLine`:
     - Restore allocated lots: `InventoryLot.RemainingQuantity += Allocated Quantity`
     - Update `Inventory.CurrentQuantity += Line.Quantity`
     - Create `StockMovement` (MovementType = Adjustment, Quantity = +ve, Reason = "Sale Void")
5. **Reverse payment:**
   - If cash refund: Create `Payment` with negative amount
   - If credit sale: Delete `Debt` or reduce balance
6. **Audit:** Log void action in `AuditLog`

**Partial Return:**
- Create new return sale (negative line items)
- Link to original sale via metadata
- Process as reverse sale (restore inventory, refund payment)

---

### 5.4 Inventory Adjustments

**Actors:** Manager, Storekeeper

**Types:**

1. **Stock Count Adjustment**
   - Physical count differs from system count
   - Create `StockMovement` (MovementType = Adjustment)
   - Adjust `Inventory.CurrentQuantity`
   - Require reason and approval

2. **Wastage**
   - Create `WastageRecord`:
     - Item, Quantity, WastageType, Reason
   - Reduce `Inventory.CurrentQuantity`
   - Deduct from oldest `InventoryLot` (FIFO)
   - Create `StockMovement` (MovementType = Waste)
   - Update cost: `EstimatedValue = Quantity × Lot.UnitPurchasePrice`

3. **Inter-Branch Transfer**
   - Create `StockMovement` records for both branches:
     - From branch: Quantity = -ve
     - To branch: Quantity = +ve
   - Transfer `InventoryLot` records (update `BranchId`)

---

### 5.5 Payment Collection (Debt Settlement)

**Customer Payment:**

1. Cashier navigates to Customer details
2. View outstanding debts (unpaid sales)
3. Select debts to pay (full or partial)
4. Create `Payment`:
   - `ReferenceType = Debt`
   - `ReferenceId = DebtId`
5. Update `Debt.AmountPaid += Payment.Amount`
6. Update `Debt.Status` (Open → PartiallyPaid → Paid)
7. If debt fully paid, update linked `Sale.PaymentStatus = Paid`

**Supplier Payment:**
- Same workflow, direction reversed (`Debt.Direction = OwedByMe`)

---

### 5.6 Expense Recording

**Steps:**

1. User creates expense:
   - Select `ExpenseCategory`
   - Enter amount, description, date
   - Attach receipt (optional)
   - Select payment method
2. If amount > threshold → require manager approval
3. Manager approves (`IsApproved = true`)
4. System creates `Payment` record if paid immediately
5. If unpaid → create `Debt` (Direction = OwedByMe)

---

### 5.7 Period Close

**End of Day (Z Report):**

1. Cashier initiates "Close Day"
2. System generates report:
   - Total sales (cash + credit)
   - Total cash received
   - Total refunds
   - Opening cash + Sales cash - Refunds - Cash withdrawals = Expected cash
3. Cashier counts physical cash, enters count
4. Variance = Expected - Actual
5. If variance > threshold → require explanation
6. Lock sales for the day (prevent backdated edits)
7. Print Z report

**End of Month:**

1. Manager reviews:
   - Inventory valuation (sum of lot values)
   - Profit & Loss statement
   - Outstanding debts
   - Wastage report
2. Approve/finalize month (optional lock)

---

## 6. Accounting & Ledger Logic

### 6.1 Chart of Accounts Template

**Account Structure:**

```
Account
├── Code (string, unique) - e.g., "1100", "4010"
├── Name (string)
├── NameAr (string?)
├── Type (enum: Asset, Liability, Equity, Revenue, Expense)
├── ParentAccountCode (string?, FK) - Hierarchical
├── IsActive (bool)
└── IsSystemAccount (bool) - Cannot be deleted
```

**Standard Template (Generalized):**

| Code | Name | Type | Description |
|------|------|------|-------------|
| **ASSETS** |
| 1000 | Assets | Asset | Root |
| 1100 | Current Assets | Asset | |
| 1110 | Cash | Asset | Cash on hand |
| 1120 | Bank Account | Asset | Bank balances |
| 1130 | Accounts Receivable | Asset | Customer debts (OwedToMe) |
| 1200 | Inventory | Asset | Stock value (FIFO) |
| 1300 | Fixed Assets | Asset | Equipment, vehicles |
| **LIABILITIES** |
| 2000 | Liabilities | Liability | Root |
| 2100 | Current Liabilities | Liability | |
| 2110 | Accounts Payable | Liability | Supplier debts (OwedByMe) |
| 2120 | VAT Payable | Liability | Tax collected |
| 2130 | Salaries Payable | Liability | Wages owed |
| **EQUITY** |
| 3000 | Equity | Equity | Owner's equity |
| 3100 | Capital | Equity | Initial investment |
| 3200 | Retained Earnings | Equity | Accumulated profits |
| **REVENUE** |
| 4000 | Revenue | Revenue | Root |
| 4010 | Sales Revenue | Revenue | Product sales |
| 4020 | Service Revenue | Revenue | (if applicable) |
| **EXPENSES** |
| 5000 | Expenses | Expense | Root |
| 5100 | Cost of Goods Sold (COGS) | Expense | Inventory cost |
| 5200 | Operating Expenses | Expense | |
| 5210 | Salaries | Expense | Wages |
| 5220 | Rent | Expense | Premises rent |
| 5230 | Utilities | Expense | Electric, water, gas |
| 5240 | Maintenance | Expense | Repairs |
| 5250 | Wastage | Expense | Spoilage, shrinkage |

**Chicken Shop Specific Additions:**

| Code | Name | Type |
|------|------|------|
| 5251 | Chicken Wastage | Expense |
| 5252 | Live Bird Shrinkage | Expense |
| 4015 | Fresh Chicken Sales | Revenue |
| 4016 | Frozen Chicken Sales | Revenue |

### 6.2 Double-Entry Ledger (Future Feature)

**Note:** Cars project does NOT implement full double-entry ledger. This is a **recommended addition** for Chicken Shop.

**Journal Entry Structure:**

```
JournalEntry : BaseEntity
├── EntryNumber (string, unique)
├── EntryDate (DateTime, indexed)
├── Description (string)
├── SourceType (string) - "Sale", "Purchase", "Payment", "Adjustment"
├── SourceId (Guid)
├── CreatedBy (Guid, FK → User)
├── IsPosted (bool) - Posted to ledger
├── IsReversed (bool) - Reversed by another entry
├── ReversedByEntryId (Guid?, FK)
└── BranchId (Guid?, FK)
```

```
JournalEntryLine
├── Id (Guid, PK)
├── JournalEntryId (Guid, FK)
├── LineNumber (int)
├── AccountCode (string, FK → Account.Code)
├── DebitAmount (decimal) - Must sum to credit amount
├── CreditAmount (decimal)
└── Description (string?)
```

### 6.3 Posting Rules

**Sale (Cash):**

```
Dr. Cash                    1,000  (Asset ↑)
Dr. COGS                      600  (Expense ↑)
  Cr. Sales Revenue               1,000 (Revenue ↑)
  Cr. Inventory                     600 (Asset ↓)
```

**Sale (Credit):**

```
Dr. Accounts Receivable     1,000  (Asset ↑)
Dr. COGS                      600  (Expense ↑)
  Cr. Sales Revenue               1,000 (Revenue ↑)
  Cr. Inventory                     600 (Asset ↓)
```

**Purchase (Cash):**

```
Dr. Inventory                 800  (Asset ↑)
  Cr. Cash                           800 (Asset ↓)
```

**Purchase (Credit):**

```
Dr. Inventory                 800  (Asset ↑)
  Cr. Accounts Payable               800 (Liability ↑)
```

**Payment Received (Customer):**

```
Dr. Cash                      500  (Asset ↑)
  Cr. Accounts Receivable            500 (Asset ↓)
```

**Payment Made (Supplier):**

```
Dr. Accounts Payable          300  (Liability ↓)
  Cr. Cash                           300 (Asset ↓)
```

**Wastage:**

```
Dr. Wastage Expense            50  (Expense ↑)
  Cr. Inventory                      50 (Asset ↓)
```

**VAT/Tax (Sale with 15% VAT):**

```
Sale amount = 1,000 + (1,000 × 15%) = 1,150

Dr. Cash                    1,150  (Asset ↑)
Dr. COGS                      600  (Expense ↑)
  Cr. Sales Revenue               1,000 (Revenue ↑)
  Cr. VAT Payable                   150 (Liability ↑)
  Cr. Inventory                     600 (Asset ↓)
```

### 6.4 Inventory Valuation & COGS

**Method:** FIFO (First In, First Out)

**Process:**

1. **Purchase:**
   - Create `InventoryLot` with `UnitPurchasePrice`
   - Increase `Inventory.CurrentQuantity`
   - Post: Dr. Inventory, Cr. Cash/Payable

2. **Sale:**
   - Allocate quantity to oldest lots first (via `SaleLineCostAllocation`)
   - Calculate `COGS = Sum(Allocated Quantity × Lot.UnitPurchasePrice)`
   - Decrease `Inventory.CurrentQuantity`
   - Post: Dr. COGS, Cr. Inventory

3. **Period-End Valuation:**
   - `Inventory Value = Sum(InventoryLot.RemainingQuantity × UnitPurchasePrice)`
   - Should match `Inventory` account balance

**Alternative (if FIFO complexity is too high):**
- Use **Weighted Average Cost** per item
- Update `Inventory.AverageCost` on each purchase
- Use average cost for COGS calculation

### 6.5 Tax/VAT Handling

**Configuration:**
- `SystemSetting.TaxEnabled = true/false`
- `SystemSetting.TaxRate = 15` (percentage)
- Per-item tax rate override: `Item.TaxRate`

**Calculation:**

```csharp
// Sale line
decimal lineAmount = quantity × unitPrice - discount;
decimal taxAmount = lineAmount × (item.TaxRate ?? systemTaxRate) / 100;
decimal lineTotalAmount = lineAmount + taxAmount;

// Sale total
Sale.TaxAmount = Sum(SaleLine.TaxAmount);
Sale.TotalAmount = Sale.GrossTotalAmount - Sale.DiscountAmount + Sale.TaxAmount;
```

**Tax Report:**
- Tax Collected (Sales): Sum(`Sale.TaxAmount` WHERE `SaleDate` IN period)
- Tax Paid (Purchases): Sum(`Purchase.TaxAmount` WHERE `PurchaseDate` IN period)
- Net Tax Payable = Collected - Paid

### 6.6 Refunds & Credit Notes

**Full Refund (Void):**
- Mark `Sale.IsVoided = true`
- Reverse inventory and payment (see section 5.3)
- Do NOT delete records (audit trail)
- Journal: Reverse original entries

**Partial Refund:**
- Create return sale (negative line items)
- Link to original: `Sale.Metadata = {"returnForSaleId": "..."}`
- Process as new sale with negative amounts
- Customer payment: Refund cash or credit to account

**Credit Note (No refund):**
- Create `Debt` with negative amount (credit balance)
- Customer can use credit on future purchases

---

## 7. UI/UX Requirements

### 7.1 Sidebar Structure

**Adapt from cars project `AppSidebar.tsx`:**

**Menu Groups:**

```typescript
const menuStructure = [
  {
    title: "لوحة التحكم", // Dashboard
    icon: LayoutDashboard,
    url: "/",
  },
  {
    title: "نقطة البيع", // Point of Sale
    icon: ShoppingBag,
    url: "/pos",
    permissions: ["sales.create"],
  },
  {
    title: "المبيعات", // Sales
    icon: DollarSign,
    url: "/sales",
    permissions: ["sales.view"],
    children: [
      { title: "قائمة المبيعات", url: "/sales" },
      { title: "بيع جديد", url: "/sales/new", permissions: ["sales.create"] },
      { title: "المرتجعات", url: "/sales/returns" },
    ],
  },
  {
    title: "المشتريات", // Purchases
    icon: ShoppingCart,
    url: "/purchases",
    permissions: ["purchases.view"], // Admin only
    children: [
      { title: "قائمة المشتريات", url: "/purchases" },
      { title: "شراء جديد", url: "/purchases/new", permissions: ["purchases.create"] },
      { title: "استلام دجاج حي", url: "/purchases/live-bird", permissions: ["purchases.liveBird"] },
    ],
  },
  {
    title: "المخزون", // Inventory
    icon: Package,
    url: "/inventory",
    permissions: ["inventory.view"],
    children: [
      { title: "حالة المخزون", url: "/inventory" },
      { title: "منتجات الدجاج", url: "/items" }, // Chicken Products
      { title: "تعديل المخزون", url: "/inventory/adjustments", permissions: ["inventory.adjust"] }, // Admin only
      { title: "سجل الهدر اليومي", url: "/inventory/wastage" }, // Daily Wastage
      { title: "التحويلات بين الفروع", url: "/inventory/transfers", permissions: ["inventory.transfer"] }, // Admin only
    ],
  },
  {
    title: "الزبائن", // Customers
    icon: Users,
    url: "/customers",
    permissions: ["customers.view"],
  },
  {
    title: "الموردين", // Suppliers
    icon: Store,
    url: "/suppliers",
    permissions: ["suppliers.manage"],
  },
  {
    title: "المدفوعات", // Payments
    icon: CreditCard,
    url: "/payments",
    permissions: ["payments.receive", "payments.make"],
    children: [
      { title: "المقبوضات", url: "/payments/received" },
      { title: "المدفوعات", url: "/payments/made" },
      { title: "الذمم", url: "/debts" },
    ],
  },
  {
    title: "المصروفات", // Expenses
    icon: Wallet,
    url: "/expenses",
    permissions: ["expenses.view"],
  },
  {
    title: "التقارير", // Reports
    icon: FileText,
    url: "/reports",
    permissions: ["reports.sales", "reports.financial", "reports.inventory"],
    children: [
      { title: "تقرير المبيعات اليومي (Z-Report)", url: "/reports/daily-sales" }, // All users
      { title: "الأرباح والخسائر", url: "/reports/profit-loss", permissions: ["reports.financial"] }, // Admin only
      { title: "تقرير المخزون", url: "/reports/inventory", permissions: ["reports.inventory"] }, // Admin only
      { title: "تقرير الهدر اليومي", url: "/reports/wastage" }, // Important for chicken
      { title: "تقرير انكماش الدجاج الحي", url: "/reports/shrinkage" }, // Admin only
      { title: "تقرير الذمم", url: "/reports/debts", permissions: ["reports.financial"] }, // Admin only
      { title: "أداء الكاشير", url: "/reports/cashier-performance", permissions: ["reports.financial"] }, // Admin only
    ],
  },
  {
    title: "الإعدادات", // Settings - Admin only
    icon: Settings,
    url: "/settings",
    permissions: ["system.settings"],
    children: [
      { title: "إعدادات عامة", url: "/settings/general" },
      { title: "الفروع", url: "/settings/branches" },
      { title: "المستخدمين (Admin/Cashier)", url: "/settings/users" },
      { title: "إعدادات الميزان", url: "/settings/scale" }, // Scale configuration
      { title: "نماذج الفواتير", url: "/settings/templates" },
      { title: "النسخ الاحتياطي", url: "/settings/backup" },
    ],
  },
];
```

**Features:**
- Collapsible sidebar (mobile: drawer, desktop: persistent)
- Active route highlighting
- Permission-based visibility (`hasPermission(item.permissions)`)
- RTL support (Arabic)
- Logo and business name from `SystemSetting`
- User info display (name, role)
- Logout button

### 7.2 Page-by-Page Requirements

#### 7.2.1 Dashboard (`/`)

**Purpose:** At-a-glance business overview

**Layout:** Grid of cards/widgets

**Widgets:**

| Widget | Content | Refresh |
|--------|---------|---------|
| **Today's Sales** | Total amount, # transactions, cash vs credit | Real-time |
| **Today's Profit** | Gross profit, profit margin % | Real-time |
| **Outstanding Debts** | Total receivables, overdue amount | Daily |
| **Low Stock Alerts** | Items below min level | Real-time |
| **Wastage Today** | Total wastage value | Real-time |
| **Quick Actions** | New Sale, New Purchase, Stock Adjustment | - |
| **Sales Chart** | Last 7 days sales trend (line chart) | Daily |
| **Top Selling Items** | Top 5 by quantity and revenue (today/this week) | Daily |

**Permissions:** All roles can view (filtered by permissions)

---

#### 7.2.2 POS / New Sale (`/pos` or `/sales/new`)

**Purpose:** Fast sales entry with weight integration

**Layout:** Split screen (desktop) or tabs (mobile)
- **Left:** Item selection
- **Right:** Cart / invoice preview

**Left Panel - Item Selection:**

**Quick Buttons Grid:**
- Pre-configured buttons for chicken products
- Large, touch-friendly (minimum 100×80px)
- Common buttons:
  - **فروج كامل طازج** (Fresh Whole Chicken)
  - **صدور دجاج** (Chicken Breast)
  - **أفخاذ دجاج** (Chicken Thighs)
  - **أجنحة دجاج** (Chicken Wings)
  - **كبد دجاج** (Chicken Liver)
  - **قوانص دجاج** (Chicken Gizzards)
  - **فروج مجمد** (Frozen Chicken)
- Display on each button:
  - Name (Arabic, large font)
  - Price per kg (e.g., "30 ر.س/كجم")
  - Stock status (🟢 متوفر / 🟡 قليل / 🔴 نفذ)
- Configurable in settings (admin only)

**Search/Browse:**
- Search bar (by name, code, barcode)
- Category filter dropdown
- Item grid/list with:
  - Name, Code, Price, Stock
  - "Add" button

**Right Panel - Cart:**

**Header:**
- Customer selector (search by name/phone, "Walk-in" default)
- Display customer credit limit & balance if selected

**Line Items Table:**

| Item | Weight (kg) | Price/kg | Discount | Total | Actions |
|------|-------------|----------|----------|-------|---------|
| فروج كامل طازج | 1.523 kg | 30.00 | - | 45.69 | 🗑️ |
| صدور دجاج | 0.850 kg | 45.00 | 2.00 | 36.25 | 🗑️ |

**Weight Reading Process (All Items):**
1. **Live Scale Display:**
   - Large weight display at top: "الوزن: 1.523 كجم" (auto-updating)
   - Visual indicator: 
     - 🔴 "غير مستقر" (unstable, changing)
     - 🟢 "جاهز" (stable, ready to add)
   
2. **Add to Cart:**
   - Click item button when weight is stable
   - Weight automatically captured from scale
   - Line added to cart with current weight
   
3. **Manual Entry (Emergency Only):**
   - Admin password required
   - Input: Weight (kg)
   - Warning displayed: "⚠️ إدخال يدوي - يتطلب موافقة المدير"
   - Reason logged in system

**Totals Section:**
```
Subtotal:               150.00 ر.س
Discount (5%):          -7.50 ر.س
Tax (15%):              21.38 ر.س
─────────────────────────────
Total:                  163.88 ر.س
```

**Payment Section:**

**Payment Type Tabs:**
- Cash
- Credit (requires Customer)
- Card
- Mixed (cash + credit)

**Cash Tab:**
- "Amount Received" input
- "Change" display (auto-calculated)

**Credit Tab:**
- Display customer credit limit and current balance
- Show warning if exceeds limit
- "Due Date" picker (default: +30 days)

**Actions:**
- **Save & Print** - Complete sale, print receipt
- **Save Draft** - Save for later
- **Clear** - Reset cart

**Keyboard Shortcuts:**
- `F2`: Search items
- `F4`: Select customer
- `F9`: Apply discount (manager password)
- `F12`: Complete sale

**Validations:**
- Stock check (if `AllowNegativeStock = false`)
- Customer credit limit check
- Discount authorization (manager PIN)

---

#### 7.2.3 Sales List (`/sales`)

**Purpose:** View and manage all sales

**Layout:** Table with filters

**Filters:**
- Date range picker (default: today)
- Customer selector (dropdown/search)
- Cashier selector
- Payment status (All, Paid, Unpaid, Partial)
- Sale number search

**Table Columns:**

| Sale # | Date | Customer | Cashier | Amount | Paid | Due | Status | Actions |
|--------|------|----------|---------|--------|------|-----|--------|---------|
| SAL-00042 | 2026-02-05 10:30 | علي محمد | Ahmad | 163.88 | 163.88 | 0 | Paid | View, Print, Void |

**Row Actions:**
- **View** - Open detail page
- **Print** - Reprint receipt
- **Void** - Cancel sale (manager only, requires reason)
- **Add Payment** - Record payment for credit sales

**Bulk Actions:**
- Export selected to Excel/PDF
- Print multiple receipts

**Pagination:** 50 per page, infinite scroll option

**Permissions:** `sales.view`

---

#### 7.2.4 Sale Detail (`/sales/:id`)

**Purpose:** View complete sale information

**Sections:**

1. **Header:**
   - Sale Number, Date, Cashier, Branch
   - Customer info (name, phone, balance)
   - Payment status badge
   - Actions: Print, Void, Add Payment

2. **Line Items Table:**
   - Item, Quantity, Unit Price, Discount, Tax, Total
   - Per-line profit (if user has permission)

3. **Totals:**
   - Subtotal, Discount, Tax, Total
   - Total Cost, Total Profit (if permitted)

4. **Payments:**
   - Table: Date, Method, Amount, Received By
   - "Add Payment" button (if unpaid/partial)

5. **Activity Log:**
   - Created by, at
   - Printed (timestamps)
   - Voided (if applicable, with reason)

**Permissions:** `sales.view`

---

#### 7.2.5 Purchases List (`/purchases`)

**Filters:**
- Date range
- Supplier selector
- Payment status
- Approval status (Pending, Approved)

**Table Columns:**

| Purchase # | Date | Supplier | Amount | Paid | Status | Approval | Actions |
|------------|------|----------|--------|------|--------|----------|---------|
| PUR-00023 | 2026-02-04 | مزرعة الخير | 5,000 | 2,000 | Partial | Approved | View, Receive, Pay |

**Actions:**
- **View** - Detail page
- **Receive** - Mark goods received, create lots
- **Pay** - Record payment
- **Approve** - Manager approval (if pending)

---

#### 7.2.6 New Purchase (`/purchases/new`)

**Layout:** Form with line items

**Fields:**
- **Supplier** (required, searchable dropdown, "+ Add New")
- **Purchase Date** (default: today)
- **Supplier Invoice #** (optional)
- **Due Date** (optional, for credit purchases)
- **Notes**

**Line Items:**

| Item | Quantity | Unit | Unit Price | Tax | Total | Actions |
|------|----------|------|------------|-----|-------|---------|
| ... | | | | | | Add, Remove |

**Add Item:** Search item, select, enter quantity and price

**Chicken Shop Specific:**
- **Live Bird Entry:**
  - Checkbox: "This is a live bird purchase"
  - Fields: Gross Weight (kg), # of Birds
  - After receiving, prompt for Net Weight
  - Auto-calculate shrinkage and real cost per kg

**Totals:**
```
Subtotal:               5,000.00 ر.س
Tax:                      750.00 ر.س
─────────────────────────────
Total:                  5,750.00 ر.س
```

**Actions:**
- **Save Draft** - Save without receiving
- **Save & Receive** - Save and mark received (creates lots)
- **Cancel**

**Validations:**
- At least one line item
- Supplier required
- Unit price > 0

---

#### 7.2.7 Goods Receiving (`/purchases/:id/receive` or `/purchases/receiving`)

**Purpose:** Mark purchases as received, create inventory lots

**Layout:** Purchase details + receiving form

**Display:**
- Purchase #, Supplier, Date, Amount
- Line items table

**Receiving Form:**

For each line item:
- Expected Quantity (from purchase)
- **Received Quantity** (editable) - can differ (over/under receive)
- **Lot Number** (auto-generated or manual)
- **Expiry Date** (for perishables)

**Chicken Shop Live Bird Receiving:**
- Display: Gross Live Weight (from purchase metadata)
- Input: **Net Usable Weight** (after processing)
- Display calculated:
  - Shrinkage: `(Gross - Net) / Gross × 100%`
  - Real Cost/kg: `Line Total / Net Weight`
- Update lot quantity to net weight

**Actions:**
- **Confirm Receive** - Create lots, update inventory, post to ledger
- **Partial Receive** - Receive some items, keep purchase open
- **Cancel**

**Validations:**
- Received quantity > 0
- If live bird, net weight required

---

#### 7.2.8 Inventory Status (`/inventory`)

**Purpose:** Real-time inventory overview

**Filters:**
- Category
- Branch (multi-location)
- Stock level (All, Low Stock, Out of Stock, Overstocked)
- Search (name, code)

**Table Columns:**

| Code | Item | Category | On Hand (kg) | Value (SAR) | Avg Cost/kg | Shelf Life | Last Restocked | Status | Actions |
|------|------|----------|--------------|-------------|-------------|------------|----------------|--------|---------|
| CH001 | فروج كامل طازج | دجاج طازج كامل | 45.5 kg | 1,365.00 | 30.00 | 2 days | 2026-02-05 08:30 | 🟢 جيد | View |
| CH002 | صدور دجاج طازج | قطع دجاج طازج | 12.3 kg | 553.50 | 45.00 | 2 days | 2026-02-05 09:15 | 🟡 قليل | View |
| CH010 | فروج مجمد | دجاج مجمد كامل | 120.0 kg | 3,000.00 | 25.00 | 90 days | 2026-02-01 | 🟢 جيد | View |

**Status Indicators:**
- 🟢 OK (above min level)
- 🟡 Low Stock (below min, above 0)
- 🔴 Out of Stock (0)
- 🔵 Overstocked (above max level)

**Actions:**
- **View** - Item detail (lots, movements)
- **Adjust** - Stock adjustment form

**Summary Cards (top):**
- Total Inventory Value
- # Items Low Stock
- # Items Out of Stock
- Total Wastage (this month)

---

#### 7.2.9 Item Detail (`/items/:id`)

**Tabs:**

1. **Details:**
   - Code, Name, Category, Barcode
   - Default prices (sale/purchase)
   - Current stock, min/max levels
   - Edit button (permissions)

2. **Lots:**
   - Table: Lot #, Received Date, Remaining Qty, Unit Cost, Expiry, Actions
   - FIFO order display

3. **Stock Movements:**
   - Table: Date, Type, Qty, Reference, Reason, By
   - Filter by date range, movement type
   - Export to Excel

4. **Sales History:**
   - Chart: Sales trend (last 30 days)
   - Table: Recent sales (date, quantity, amount)

---

#### 7.2.10 Stock Adjustment (`/inventory/adjustments/new`)

**Purpose:** Correct inventory discrepancies

**Fields:**
- **Item** (search/select)
- **Current System Quantity** (read-only, from `Inventory.CurrentQuantity`)
- **Physical Count Quantity** (input)
- **Difference** (auto-calculated: Physical - System)
- **Reason** (required, dropdown: Stock Count Correction, Loss, Found, Other)
- **Notes** (optional)
- **Branch**

**Actions:**
- **Submit** - Create `StockMovement`, update `Inventory`, require manager approval
- **Cancel**

**Permissions:** `inventory.adjust`

---

#### 7.2.11 Wastage Entry (`/inventory/wastage/new`)

**Fields:**
- **Item**
- **Quantity**
- **Wastage Type** (Spoilage, Trimming Loss, Expired, Damaged, Other)
- **Reason** (required, text)
- **Estimated Value** (auto-filled from lot cost, editable)
- **Photo** (optional, attach image)

**Actions:**
- **Save** - Create `WastageRecord`, reduce inventory, create expense entry
- **Cancel**

**Permissions:** `inventory.waste`

---

#### 7.2.12 Customers List (`/customers`)

**Table Columns:**

| # | Name | Phone | Balance | Credit Limit | Last Purchase | Actions |
|---|------|-------|---------|--------------|---------------|---------|
| C001 | علي محمد | 0501234567 | 500 | 2,000 | 2026-02-04 | View, Edit, Statement |

**Filters:**
- Search (name, phone)
- Balance status (All, Has Balance, Zero Balance, Overdue)

**Actions:**
- **View** - Detail page (sales, payments, debts)
- **Edit** - Update info, credit limit
- **Statement** - Print customer statement (sales, payments, balance)

---

#### 7.2.13 Customer Detail (`/customers/:id`)

**Tabs:**

1. **Info:**
   - Name, Phone, Address
   - Credit limit, Current balance
   - Edit button

2. **Sales:**
   - Table of customer's sales
   - Filter by date, status

3. **Debts:**
   - Outstanding debts table
   - Total owed
   - "Add Payment" button

4. **Payments:**
   - Payment history table

5. **Statement:**
   - Printable statement: Opening balance, Sales, Payments, Closing balance
   - Date range filter

---

#### 7.2.14 Suppliers List (`/suppliers`)

Similar structure to Customers List.

**Table Columns:**

| # | Name | Phone | Balance (We Owe) | Last Purchase | Actions |
|---|------|-------|------------------|---------------|---------|
| S001 | مزرعة الخير | 0567891234 | 3,000 | 2026-02-04 | View, Edit, Statement |

---

#### 7.2.15 Debts Overview (`/debts`)

**Purpose:** Manage all receivables and payables

**Tabs:**

1. **Receivables (Owed to us):**
   - Table: Customer, Total, Paid, Remaining, Due Date, Status, Actions
   - Filter: Overdue, Due Soon, All

2. **Payables (We owe):**
   - Table: Supplier, Total, Paid, Remaining, Due Date, Status, Actions

**Actions:**
- **Pay** - Record payment
- **View** - Debt detail (linked sales/purchases, payments)

---

#### 7.2.16 Expenses List (`/expenses`)

**Filters:**
- Date range
- Category
- Approval status

**Table Columns:**

| Date | Category | Description | Amount | Payment Method | Status | Actions |
|------|----------|-------------|--------|----------------|--------|---------|
| 2026-02-05 | Rent | Shop Rent Feb | 10,000 | Cash | Approved | View, Edit |

**Actions:**
- **New Expense** - Open form
- **Approve** - Manager approval
- **View** - Detail with attachments

---

#### 7.2.17 Expense Form (`/expenses/new`, `/expenses/:id/edit`)

**Fields:**
- **Date** (default: today)
- **Category** (dropdown)
- **Amount**
- **Description** (required)
- **Supplier** (optional, for supplier payments)
- **Payment Method** (Cash, Card, Bank Transfer, Unpaid)
- **Reference #** (invoice/receipt number)
- **Attachment** (upload receipt image)

**Actions:**
- **Save** - Submit for approval
- **Save & Approve** (if user is manager)
- **Cancel**

---

#### 7.2.18 Settings - General (`/settings/general`)

**Sections:**

1. **Business Information:**
   - Business Name (AR/EN)
   - Logo (upload)
   - Address, Phone

2. **Regional:**
   - Currency (dropdown: SAR, USD, etc.)
   - Currency Symbol
   - Default Language (AR/EN)
   - Date Format

3. **Tax/VAT:**
   - Enable Tax (checkbox)
   - Tax Rate (%)
   - Tax Label (e.g., "VAT", "ضريبة القيمة المضافة")
   - Tax Number (business registration)

4. **Fiscal:**
   - Fiscal Year Start (MM-DD)

5. **Inventory:**
   - Allow Negative Stock (checkbox) - Not recommended for fresh chicken
   - Inventory Method: **FIFO** (fixed, cannot change)
   - Primary Weight Unit: **kg** (fixed, cannot change)
   - Fresh Chicken Shelf Life (days): 2 (configurable)
   - Frozen Chicken Shelf Life (days): 90 (configurable)
   - Default Shrinkage Percentage: 25% (for live bird purchases)

6. **Numbering:**
   - Sale Number Prefix (e.g., "SAL-")
   - Purchase Number Prefix
   - Auto-numbering format

7. **POS:**
   - Auto Debt Creation (checkbox)
   - Cashier Discount Limit (%)
   - Require Manager Approval for Discount > X%

**Actions:**
- **Save** - Validate and update `SystemSetting` table

**Permissions:** `system.settings`

---

#### 7.2.19 Settings - Scale Configuration (`/settings/scale`)

**Purpose:** Configure digital weighing scale integration

**Sections:**

1. **Connection Settings:**
   - Connection Type (Serial/USB)
   - COM Port (dropdown: COM1, COM2, COM3, etc.)
   - Baud Rate (dropdown: 9600, 19200, 38400, 57600, 115200)
   - Data Bits: 8 (fixed)
   - Parity: None (fixed)
   - Stop Bits: 1 (fixed)
   - Test Connection (button)

2. **Reading Settings:**
   - Auto-read Interval (ms): 200 (how often to poll scale)
   - Stability Threshold (kg): 0.01 (weight must be stable within ±0.01 kg)
   - Stability Duration (seconds): 2 (weight stable for 2 seconds before "ready")
   - Minimum Weight (kg): 0.05 (readings below this ignored as noise)

3. **Display Settings:**
   - Show Live Weight in POS: Yes/No
   - Weight Display Precision: 3 decimals (e.g., 1.523 kg)
   - Beep on Stable Weight: Yes/No

4. **Emergency Settings:**
   - Allow Manual Weight Entry: Yes/No
   - Require Admin Password for Manual Entry: Yes/No

**Actions:**
- **Test Scale** - Read current weight from scale
- **Calibrate** - Zero calibration (requires empty scale)
- **Save** - Save settings

**Permissions:** `system.settings` (Admin only)

---

#### 7.2.20 Settings - Branches (`/settings/branches`)

**Table:** List of branches

**Actions:**
- **Add Branch** - Form (name, code, address, phone)
- **Edit** - Update branch
- **Set as Main** - Mark as main branch
- **Deactivate** - Soft delete

---

#### 7.2.21 Settings - Users (`/settings/users`)

**Purpose:** Manage system users (Admin and Cashier only)

**Single Tab - Users List:**

**Table:**

| Username | Full Name (AR) | Role | Last Login | Status | Actions |
|----------|----------------|------|------------|--------|---------|
| owner | محمد أحمد | مدير (Admin) | 2026-02-06 08:30 | 🟢 Active | Edit, View |
| cashier1 | فاطمة علي | كاشير (Cashier) | 2026-02-06 09:00 | 🟢 Active | Edit, Deactivate |
| cashier2 | أحمد خالد | كاشير (Cashier) | 2026-02-05 14:30 | 🔴 Inactive | Activate |

**Add User Form:**
- Username (required, unique)
- Full Name (Arabic) (required)
- Full Name (English) (optional)
- Email (optional)
- Phone (optional)
- Password (required, min 8 chars)
- Confirm Password
- **Role** (required, dropdown):
  - مدير / مالك (Administrator)
  - كاشير / بائع (Cashier)
- Default Branch (if multi-branch)
- Preferred Language (Arabic/English)

**Edit User:**
- Update name, email, phone
- Change role (Admin/Cashier)
- Reset password
- Deactivate/Activate user

**Notes:**
- Only 2 roles: Admin and Cashier
- Cannot create custom roles
- Cannot delete users (only deactivate)
- At least one active Admin required

**Permissions:** `system.users` (Admin only)

---

### 7.3 Responsive Design

- **Desktop (≥1024px):** Full sidebar, table views
- **Tablet (768-1023px):** Collapsible sidebar, responsive tables
- **Mobile (<768px):** Drawer menu, card-based lists, simplified forms

**Touch Optimization:**
- Minimum tap target: 44×44px
- Large buttons for POS
- Swipe gestures (e.g., swipe row to delete/edit)

---

### 7.4 Accessibility

- **WCAG 2.1 AA compliance**
- Keyboard navigation (tab order, shortcuts)
- Screen reader support (ARIA labels)
- High contrast mode option
- Font size adjustment

---

### 7.5 Internationalization (i18n)

**Languages:** Arabic (primary), English

**RTL Support:**
- CSS: `direction: rtl` for Arabic
- Flip icons and layouts
- Number formatting: Arabic-Indic numerals option (٠١٢٣٤٥٦٧٨٩)

**Date/Time:**
- Format: YYYY-MM-DD HH:mm (ISO)
- Display: Configurable (e.g., Arabic: ٢٠٢٦-٠٢-٠٥, English: 05/02/2026)

**Currency:**
- Display: `Currency Symbol + Amount` (e.g., "163.88 ر.س", "$163.88")
- Formatting: Thousands separator, 2 decimal places

**Translation Management:**
- Use i18n library (e.g., `react-i18next`)
- JSON translation files: `locales/ar.json`, `locales/en.json`

---

## 8. Reporting

### 8.1 Financial Reports

#### 8.1.1 Daily Sales Report (Z Report)

**Purpose:** End-of-day cashier reconciliation

**Parameters:**
- Date (default: today)
- Cashier (optional filter)
- Branch

**Content:**

```
📊 Daily Sales Report - 2026-02-05
───────────────────────────────────

Opening Cash:                  1,000.00 ر.س

Sales Summary:
  Cash Sales:                 15,230.00 ر.س
  Credit Sales:                3,450.00 ر.س
  Card Sales:                  2,100.00 ر.س
  ─────────────────────────────────
  Total Sales:                20,780.00 ر.س

Payments Received (Credit):     1,200.00 ر.س
Refunds:                         -150.00 ر.س
Cash Withdrawals:               -500.00 ر.س

Expected Cash:                 16,780.00 ر.س
Actual Cash (Counted):         16,750.00 ر.س
Variance:                        -30.00 ر.س ⚠️

# Transactions:                      45
# Customers Served:                  38
Average Transaction:              462.22 ر.س

Top Selling Items:
  1. فروج كامل          15 kg    450.00 ر.س
  2. صدور دجاج          10 kg    350.00 ر.س
  3. أفخاذ دجاج         8 kg     240.00 ر.س
```

**Export:** PDF, Print

---

#### 8.1.2 Profit & Loss Statement

**Purpose:** Period financial performance

**Parameters:**
- From Date, To Date (default: current month)
- Branch (All or specific)

**Structure:**

```
📈 Profit & Loss Statement
Period: 2026-02-01 to 2026-02-05
───────────────────────────────────

REVENUE
  Sales Revenue                   85,340.00 ر.س
  ─────────────────────────────────
  Total Revenue                   85,340.00 ر.س

COST OF GOODS SOLD
  Opening Inventory                12,000.00 ر.س
  Purchases                        45,000.00 ر.س
  Closing Inventory               -15,000.00 ر.س
  ─────────────────────────────────
  Total COGS                       42,000.00 ر.س

GROSS PROFIT                       43,340.00 ر.س
Gross Margin:                         50.8%

OPERATING EXPENSES
  Salaries                          5,000.00 ر.س
  Rent                             10,000.00 ر.س
  Utilities                         1,500.00 ر.س
  Maintenance                         800.00 ر.س
  Wastage                           1,200.00 ر.س
  Other                               500.00 ر.س
  ─────────────────────────────────
  Total Expenses                   19,000.00 ر.س

NET PROFIT                         24,340.00 ر.س
Net Margin:                           28.5%
```

**Export:** Excel, PDF

**Permissions:** `reports.financial`

---

#### 8.1.3 Cash Flow Report

**Purpose:** Track cash in/out

**Parameters:** Date range

**Content:**

```
💰 Cash Flow Report
───────────────────────────────────

CASH INFLOWS
  Cash Sales                      68,500.00 ر.س
  Customer Payments                5,200.00 ر.س
  ─────────────────────────────────
  Total Inflows                   73,700.00 ر.س

CASH OUTFLOWS
  Supplier Payments               35,000.00 ر.س
  Expenses Paid                   19,000.00 ر.س
  Salaries Paid                    5,000.00 ر.س
  Withdrawals                      2,000.00 ر.س
  ─────────────────────────────────
  Total Outflows                  61,000.00 ر.س

NET CASH FLOW                     12,700.00 ر.س

Opening Balance:                  10,000.00 ر.س
Closing Balance:                  22,700.00 ر.س
```

---

#### 8.1.4 Accounts Receivable (Debts Owed to Us)

**Parameters:** As of date

**Table:**

| Customer | Total Sales | Paid | Balance | Overdue | Last Payment |
|----------|-------------|------|---------|---------|--------------|
| علي محمد | 5,000 | 4,500 | 500 | - | 2026-02-03 |
| أحمد خالد | 2,000 | 0 | 2,000 | 1,500 | - |

**Summary:**
- Total Receivables: 15,000 ر.س
- Current (not overdue): 10,000 ر.س
- Overdue: 5,000 ر.س

**Aging:**
- 0-30 days: 8,000 ر.س
- 31-60 days: 4,000 ر.س
- 61-90 days: 2,000 ر.س
- 90+ days: 1,000 ر.س (bad debt risk)

---

### 8.2 Operational Reports

#### 8.2.1 Inventory Valuation Report

**Purpose:** Current inventory value

**Table:**

| Item | Category | Quantity | Avg Cost | Total Value |
|------|----------|----------|----------|-------------|
| فروج كامل | دجاج طازج | 45.5 kg | 30.00 | 1,365.00 |

**Summary:**
- Total Inventory Value: 24,580.00 ر.س
- # Items: 45
- # Items Low Stock: 5

---

#### 8.2.2 Wastage Report

**Parameters:** Date range

**Table:**

| Date | Item | Quantity | Type | Reason | Value |
|------|------|----------|------|--------|-------|
| 2026-02-05 | فروج كامل | 2 kg | Spoilage | End of day unsold | 60.00 |

**Summary:**
- Total Wastage Value: 1,200.00 ر.س
- Wastage % of COGS: 2.9%

**Chart:** Wastage trend (line chart, last 30 days)

---

#### 8.2.3 Live Bird Shrinkage Report

**Purpose:** Track shrinkage percentage in live bird purchases (critical for cost control)

**Parameters:** Date range

**Table:**

| Purchase Date | Supplier | # Birds | Gross Weight (kg) | Net Weight (kg) | Shrinkage (kg) | Shrinkage % | Total Cost | Real Cost/kg |
|---------------|----------|---------|-------------------|-----------------|----------------|-------------|------------|--------------|
| 2026-02-05 | مزرعة الخير | 50 | 100.5 | 75.2 | 25.3 | 25.15% | 650.00 | 8.67 |
| 2026-02-04 | مزرعة النور | 40 | 82.0 | 60.0 | 22.0 | 26.83% | 540.00 | 9.00 |
| 2026-02-03 | مزرعة الخير | 60 | 120.0 | 90.5 | 29.5 | 24.58% | 750.00 | 8.29 |

**Summary:**
- Total Purchases: 3
- Total Birds: 150
- Total Gross Weight: 302.5 kg
- Total Net Weight: 225.7 kg
- Total Shrinkage: 76.8 kg
- **Average Shrinkage %: 25.39%**
- Average Real Cost/kg: 8.65 SAR

**Chart:** Shrinkage percentage trend (line chart)

**Analysis:**
- Compare shrinkage by supplier (which supplier has lowest shrinkage)
- Track shrinkage trends over time
- Alert if shrinkage > 30% (abnormal)

**Export:** Excel, PDF

**Permissions:** `reports.financial` (Admin only)

---

#### 8.2.5 Item Sales Report

**Parameters:** Date range, Item (optional)

**Purpose:** Analyze product performance

**Table:**

| Item | Qty Sold | Revenue | COGS | Profit | Margin % |
|------|----------|---------|------|--------|----------|
| فروج كامل | 150 kg | 4,500 | 3,000 | 1,500 | 33.3% |

**Sort by:** Revenue, Profit, Quantity

---

#### 8.2.6 Supplier Purchase History

**Parameters:** Supplier, Date range

**Table:**

| Date | Purchase # | Amount | Paid | Balance |
|------|-----------|--------|------|---------|
| 2026-02-04 | PUR-00023 | 5,750 | 2,000 | 3,750 |

**Summary:**
- Total Purchases: 45,000 ر.س
- Total Paid: 30,000 ر.س
- Outstanding: 15,000 ر.س

---

#### 8.2.7 Cashier Performance Report

**Parameters:** Date range

**Purpose:** Compare cashier sales

**Table:**

| Cashier | # Sales | Total Amount | Avg Sale | Discounts Given | Voids |
|---------|---------|--------------|----------|-----------------|-------|
| أحمد | 120 | 38,500 | 320.83 | 350.00 | 2 |
| فاطمة | 95 | 29,100 | 306.32 | 150.00 | 0 |

---

### 8.3 Export Formats

**Supported:**
- **PDF:** Formatted reports with business logo, print-ready
- **Excel (XLSX):** Data tables, pivot-ready
- **CSV:** Raw data export

**All reports include:**
- Business name and logo
- Report title
- Date range / parameters
- Generated date and time
- Generated by user

---

## 9. Integrations & Imports/Exports

### 9.1 Hardware Integrations

**Digital Weighing Scale (REQUIRED - Critical for Chicken Shop):**

**Importance:** All chicken products sold by weight. Scale integration is mandatory for accurate weighing and profit calculation.

**Technical Specifications:**
- **Protocol:** Serial (RS232) or USB
- **Communication:** One-way (scale → system) or two-way
- **Common Scale Brands:** 
  - Aclas scales (popular in Middle East)
  - Digi scales
  - Toledo scales
  - CAS scales
  
**Integration Details:**
- **Connection:**
  - Serial: COM port (RS232), configurable baud rate (typically 9600)
  - USB: Virtual COM port driver
  
- **Data Format:**
  - Most scales send weight as ASCII string
  - Example: "ST,+001.523kg\r\n" (stable weight: 1.523 kg)
  - Parse format based on scale model
  
- **Auto-read Mode:**
  - Poll scale every 200ms (configurable)
  - Parse weight from response
  - Determine stability (weight unchanged for 2 seconds)
  - Display: 🔴 "غير مستقر" or 🟢 "جاهز - 1.523 كجم"
  
- **Calibration:**
  - Zero calibration (empty scale)
  - Span calibration (known weight)
  - Admin-only access
  - Store calibration date in settings
  
- **Fallback:**
  - Manual entry with admin password
  - Log all manual entries for audit
  - Alert: "⚠️ Scale not responding - check connection"

**Thermal Receipt Printer:**
- **Protocol:** ESC/POS (standard for most thermal printers)
- **Connection:** USB, Network (IP), Bluetooth
- **Receipt format:** Configurable template (business name, logo, line items, totals)
- **Arabic support:** UTF-8 encoding

**Barcode Scanner:**
- **Type:** Handheld or fixed
- **Input:** Keyboard wedge (simulates keyboard input)
- **Scan triggers:** Item search in POS, receive goods

**Cash Drawer:**
- **Trigger:** Opens automatically on sale completion (via printer kick-out signal)

### 9.2 Payment Gateway Integration (Optional)

**If required:**
- Integrate with local payment providers (e.g., Tap, Telr, Checkout.com for Middle East)
- **Flow:** POS → Payment request → Gateway → Redirect/QR → Callback → Update payment status
- **Storage:** `Payment.BankTransactionId` for reconciliation

### 9.3 Data Import

**Bulk Import via Excel/CSV:**

**Chicken Products Import:**
- Template columns:
  - Code (e.g., "CH-WHOLE-001")
  - Name (Arabic) (e.g., "فروج كامل طازج")
  - Name (English) (optional)
  - Category Code (e.g., "FRESH_WHOLE")
  - Barcode (optional)
  - Sale Price per Kg (SAR)
  - Purchase Price per Kg (SAR)
  - Min Stock Level (kg)
  - Shelf Life (days)
  - Storage Location (Fridge/Freezer/Display)
- Process: Upload Excel → Validate → Preview → Confirm
- Create/update chicken products

**Opening Inventory:**
- Template columns:
  - Item Code
  - Weight (kg)
  - Unit Cost per Kg (SAR)
  - Lot Number (auto-generated if empty)
  - Expiry Date (calculated from shelf life if empty)
  - Branch (if multi-branch)
- Creates `InventoryLot` records with FIFO tracking
- Use for initial inventory setup or periodic stock count import

**Customers/Suppliers:**
- Template: Name, Phone, Email, Address, Credit Limit

### 9.4 Data Export

**Full Data Backup:**
- **Format:** SQL dump (for database-per-tenant)
- **Schedule:** Daily automatic backup (configurable)
- **Storage:** Local file, cloud (optional: S3, Google Drive)

**Accounting Export:**
- Export journal entries to external accounting software format
- **Formats:** QuickBooks IIF, Excel with chart of accounts mapping

---

## 10. Non-Functional Requirements

### 10.1 Performance

**Response Times:**
- POS: < 100ms for item add, < 500ms for sale completion
- Reports: < 3s for standard reports, < 10s for complex aggregations
- Search: < 200ms for autocomplete

**Throughput:**
- Support 100+ concurrent POS transactions/hour per branch
- Handle 10,000+ sales per day per tenant

**Database:**
- Index optimization (see section 4.4)
- Query pagination (max 1000 records per request)

### 10.2 Scalability

**Vertical Scaling:**
- Single tenant database scales with business growth
- Optimize queries, add indexes as needed

**Horizontal Scaling:**
- Database-per-tenant architecture allows distribution across servers
- Application servers: Stateless, load-balanced

**Data Archiving:**
- Archive sales/purchases older than 2 years (configurable)
- Keep aggregated reports, move details to archive database

### 10.3 Security

**Authentication:**
- JWT tokens with refresh token rotation
- Session timeout: 8 hours (configurable)
- Strong password policy (min 8 chars, complexity)

**Authorization:**
- Role-based access control (RBAC)
- Permission checks on every API call
- UI elements hidden if no permission

**Data Protection:**
- Passwords: Bcrypt hashing (cost factor 12)
- Sensitive fields: Encryption at rest (optional: AES-256)
- HTTPS/TLS for all communications

**Audit:**
- `AuditLog` table captures all critical actions
- Immutable records (no delete/update)
- Retention: 5 years (compliance)

**Backup:**
- Daily automated backups
- Encrypted backup files
- Off-site storage (cloud or secondary server)

### 10.4 Availability

**Uptime:** 99.5% target (cloud-hosted) or offline-first (local)

**Offline Mode:**
- Local database (SQLite or PostgreSQL local instance)
- Queue transactions when offline
- Sync to cloud when reconnected (if cloud enabled)

**Disaster Recovery:**
- Backup restore procedure documented
- RTO (Recovery Time Objective): < 4 hours
- RPO (Recovery Point Objective): < 24 hours

### 10.5 Usability

**Onboarding:**
- Setup wizard: Business info, branches, users, initial inventory
- Sample data (optional demo mode)

**Help & Documentation:**
- In-app help tooltips
- User manual (PDF, searchable)
- Video tutorials (optional)

**Error Handling:**
- User-friendly error messages (avoid technical jargon)
- Actionable guidance (e.g., "Stock insufficient. Current: 5 kg, Requested: 10 kg. Adjust quantity or override.")
- Toast notifications for success/errors

**Training:**
- Admin training: 2 days
- Cashier training: 4 hours
- Support: Email, phone, in-app chat (optional)

### 10.6 Maintainability

**Code Quality:**
- Clean architecture (separation of concerns)
- Service layer pattern (as in cars project)
- Unit tests (>70% coverage target)
- Integration tests for critical workflows

**Logging:**
- Structured logs (JSON format)
- Log levels: Debug, Info, Warning, Error
- Centralized logging (optional: ELK stack, CloudWatch)

**Monitoring:**
- Application performance monitoring (APM)
- Database query performance tracking
- Alerts: High error rate, slow queries, disk space

**Version Control:**
- Git repository
- Semantic versioning (v1.0.0, v1.1.0, etc.)
- Changelog for each release

### 10.7 Compliance

**Data Privacy:**
- GDPR-compliant (if EU customers): Right to access, deletion
- Local regulations (e.g., Saudi Arabia PDPL)

**Accounting Standards:**
- Audit trail (immutable transaction history)
- No deletion of financial records (void/reverse only)

**Tax Compliance:**
- VAT reporting (if applicable)
- Export tax reports in required format

---

## 11. Acceptance Criteria

### 11.1 General

- [ ] Single database for chicken shop (no multi-tenant complexity)
- [ ] Configuration layer: Currency, tax, scale settings configurable via `SystemSetting`
- [ ] Two roles only: Admin (full access) and Cashier (limited access)
- [ ] Permissions enforced on backend API and UI
- [ ] Arabic/RTL as primary language with English secondary
- [ ] Responsive UI works on desktop (≥1024px), tablet (768-1023px), mobile (<768px)
- [ ] All products sold by weight (kg) - no piece/unit selling

### 11.2 Sales Module

- [ ] POS interface: Add chicken products (weight-based only), apply discounts, select payment type
- [ ] Digital scale integration: Auto-read weight from scale, display live weight with stability indicator
- [ ] Weight validation: All items must have weight > 0 kg, block zero-weight sales
- [ ] Manual weight entry: Only with admin password override, logged for audit
- [ ] Sale completion: Generate unique sale number (SAL-XXXXXX), print receipt, update inventory
- [ ] FIFO cost allocation: Sale lines allocated to oldest inventory lots first (critical for accurate profit)
- [ ] Profit calculation: `TotalProfit = TotalAmount - TotalCost` (from FIFO allocations)
- [ ] Credit sales: Customer required, due date set, debt auto-created if unpaid
- [ ] Payment recording: Cash, card, mixed payments; update `AmountPaid` and `PaymentStatus`
- [ ] Discount limits: Cashier max 5%, Admin unlimited, require password for override
- [ ] Sale void: Admin only, reason required, inventory and payment reversed
- [ ] Partial returns: Create return sale, refund payment, restore inventory to FIFO lots

### 11.3 Purchases Module (Admin Only)

- [ ] Purchase order: Add supplier, line items (by weight kg), calculate tax and total
- [ ] All purchases by weight (kg) - no piece/unit purchasing
- [ ] Goods receiving: Create `InventoryLot` per line, update `Inventory.CurrentQuantity`, create `StockMovement`
- [ ] **Live bird receiving workflow (Critical):**
  - [ ] Enter number of birds and gross live weight (kg)
  - [ ] After processing, enter net usable weight (kg)
  - [ ] System calculates shrinkage % = (Gross - Net) / Gross × 100
  - [ ] System calculates real cost per kg = Total Amount / Net Weight
  - [ ] Create inventory lot with net weight and real cost/kg
  - [ ] Store gross weight, net weight, shrinkage % in metadata
  - [ ] Create wastage record for shrinkage amount
- [ ] Payment recording: Full/partial supplier payments, update `Purchase.PaymentStatus`
- [ ] Debt auto-creation: Unpaid purchases create `Debt` (Direction = OwedByMe)
- [ ] Expiry date calculation: Auto-calculate based on item shelf life from receiving date

### 11.4 Inventory Module

- [ ] Inventory status: View current stock (kg), value, average cost per kg per item
- [ ] All inventory tracked by weight (kg) - no pieces/units
- [ ] Low stock alerts: Items below `MinStockLevel` (kg) flagged with 🟡 warning
- [ ] Expiry alerts: Items expiring within 1 day (fresh) or 7 days (frozen) highlighted
- [ ] Stock movements: Complete audit trail (purchase, sale, adjustment, waste, transfer)
- [ ] Inventory adjustment: Correct discrepancies, require reason and admin approval
- [ ] **Wastage recording (Critical for chicken):**
  - [ ] Record waste by weight (kg) and type (spoilage, trimming, expired, etc.)
  - [ ] Mandatory reason entry
  - [ ] Calculate cost value from FIFO lot allocation
  - [ ] Optional photo attachment
  - [ ] Create expense entry for waste cost
  - [ ] Daily wastage summary report
- [ ] FIFO lot tracking: `InventoryLot` table tracks lots with received date, sales consume oldest first
- [ ] Shelf life tracking: Auto-calculate expiry date = received date + shelf life days
- [ ] Inter-branch transfers: Move inventory between branches (if multi-branch), update lot `BranchId`

### 11.5 Customers & Suppliers

- [ ] Customer management: Create, edit, view customers; track credit limit and balance
- [ ] Supplier management: Create, edit, view suppliers; track balances
- [ ] Customer statement: Print statement (sales, payments, balance) for date range
- [ ] Credit limit enforcement: Block sales if customer balance exceeds limit (unless overridden)

### 11.6 Debts & Payments

- [ ] Debt auto-creation: Sales/purchases with `AmountDue > 0` create `Debt` records
- [ ] Debt tracking: Separate receivables (OwedToMe) and payables (OwedByMe)
- [ ] Payment recording: Link payments to debts, update `AmountPaid` and `Status`
- [ ] Overdue alerts: Flag debts past due date

### 11.7 Expenses

- [ ] Expense recording: Create expense with category, amount, description, payment method
- [ ] Approval workflow: Expenses > threshold require manager approval
- [ ] Expense categories: Configurable categories linked to chart of accounts

### 11.8 Reporting

- [ ] Daily sales report (Z Report): Sales totals, cash reconciliation, variance tracking
- [ ] Profit & Loss: Revenue, COGS, gross profit, expenses, net profit for date range
- [ ] Cash flow report: Inflows, outflows, net cash flow
- [ ] Accounts receivable: Aging report (0-30, 31-60, 61-90, 90+ days)
- [ ] Inventory valuation: Total inventory value, per-item breakdown
- [ ] Wastage report: Total wastage value, % of COGS, trend analysis
- [ ] Item sales report: Qty sold, revenue, COGS, profit, margin per item
- [ ] Cashier performance: Sales count, amount, avg sale, discounts, voids per cashier
- [ ] Export: All reports exportable to PDF, Excel, CSV

### 11.9 Permissions & Security

- [ ] **Two roles only:** Admin (full access) and Cashier (limited access)
- [ ] **Admin permissions:** All modules, settings, reports, purchases, expenses, user management
- [ ] **Cashier permissions:** POS, sales, customer payments, daily sales report (own sales only)
- [ ] Permission enforcement: API checks permissions before executing actions
- [ ] UI filtering: Menu items and actions hidden if user lacks permission
- [ ] Discount limits: Cashier max 5%, Admin unlimited, password required for override
- [ ] Manual weight entry: Admin password required
- [ ] Sale void: Admin only with reason
- [ ] Audit logging: All critical actions logged (sales, purchases, voids, adjustments, manual weights)
- [ ] Password security: Bcrypt hashing, strong password policy (min 8 chars)
- [ ] JWT authentication: Tokens with refresh, session timeout (default 8 hours)
- [ ] Cannot delete financial records: Only void/reverse with reason

### 11.10 Configuration & Settings (Admin Only)

- [ ] **System settings:** Currency, tax rate, language, numbering prefixes
- [ ] **Chicken-specific settings:**
  - [ ] Fresh chicken shelf life (default: 2 days)
  - [ ] Frozen chicken shelf life (default: 90 days)
  - [ ] Default shrinkage percentage (default: 25%)
  - [ ] Weight unit fixed to kg (not configurable)
  - [ ] FIFO inventory method (not configurable)
- [ ] **Scale configuration:**
  - [ ] COM port selection
  - [ ] Baud rate, data bits, parity, stop bits
  - [ ] Auto-read interval, stability threshold
  - [ ] Test connection, calibration
  - [ ] Manual entry settings (allow/require password)
- [ ] Branch management: Create, edit, deactivate branches (if multi-branch)
- [ ] User management: Create Admin/Cashier users only, assign role, deactivate users
- [ ] Receipt templates: Configurable thermal printer receipt format (Arabic/English)
- [ ] Hardware settings: Scale, printer, scanner, cash drawer integration

### 11.11 Non-Functional

- [ ] Performance: POS response < 100ms, reports < 3s, search < 200ms
- [ ] Offline mode: Local database, queue transactions, sync when online
- [ ] Backup: Daily automated backup, encrypted, off-site storage
- [ ] Responsive design: Works on desktop, tablet, mobile
- [ ] Accessibility: WCAG 2.1 AA compliant, keyboard navigation, screen reader support
- [ ] Error handling: User-friendly messages, actionable guidance
- [ ] Logging: Structured logs, centralized (optional)
- [ ] Monitoring: APM, query performance tracking, alerts

---

## Summary

This PRD defines a **specialized POS, Inventory & Accounting System for Chicken Retail Shops (محلات الدجاج)** by:

1. **Building on proven patterns** from the cars project:
   - Base entity with audit fields
   - FIFO inventory costing via `InventoryLot` and `SaleLineCostAllocation`
   - Payment and debt tracking
   - Service layer architecture with DTOs
   - Sidebar navigation and route structure
   - React Query composables pattern

2. **Chicken Shop Specialization:**
   - **Weight-based selling exclusively (kg)** - no piece/unit selling
   - **Digital scale integration (required)** - auto-read weights, stability detection
   - **Live bird purchase tracking** - gross weight, net weight, shrinkage calculation, real cost per kg
   - **Daily wastage management** - spoilage, trimming, expiry tracking with cost impact
   - **Shelf life tracking** - 2 days (fresh), 90 days (frozen), auto-expiry alerts
   - **Arabic-first UI with RTL support** - primary language for Middle East markets
   - **Simplified roles** - Admin (full access) and Cashier (limited access) only

3. **Critical Features for Chicken Business:**
   - Live bird shrinkage calculation (typically 20-30%)
   - Real cost per kg calculation after processing
   - Daily wastage reports (critical for perishable products)
   - FIFO lot tracking for accurate profit calculation
   - Expiry alerts for fresh chicken (2-day shelf life)
   - Temperature-dependent storage tracking (fridge/freezer)

4. **Implementation Ready:**
   - Complete data schema optimized for chicken shop workflows
   - Detailed workflows for live bird receiving and processing
   - Digital scale integration specifications (serial/USB, protocols)
   - Page-by-page UI specifications with Arabic labels
   - Accounting logic (FIFO, tax, ledger postings) - **kept complete as requested**
   - Two-role permission system (Admin/Cashier)
   - Comprehensive reporting (sales, profit, wastage, shrinkage) - **all reports kept**
   - Non-functional requirements (performance, security, offline-first)
   - Acceptance criteria for all modules

This PRD is ready for engineering teams to implement a production-ready chicken shop management system without ambiguity.

---

**End of Document**
