# Product Requirements Document (PRD)
## Unified POS, Inventory, and Accounting System
### Multi-Vertical Business Management Platform

**Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Implementation Ready

---

## 1. Overview

### 1.1 Purpose
This document defines the complete product requirements for a unified business management system that integrates Point of Sale (POS), inventory management, accounting, and customer/supplier relationship management. The system is designed as a **multi-tenant, vertical-agnostic platform** that can be configured for various industries including retail, services, and specialty shops.

### 1.2 Problem Statement
Small and medium businesses struggle with:
- Fragmented systems (separate POS, inventory, accounting)
- Manual reconciliation and data entry errors
- Inability to track real-time profitability and cash flow
- Poor inventory visibility leading to waste and stockouts
- Complex accounting that requires specialized knowledge
- Lack of affordable, localized solutions (Arabic/RTL support)

### 1.3 Goals
- **Speed**: Fast transaction processing (< 3 seconds per sale)
- **Accuracy**: Automatic FIFO cost tracking, no manual journal entries
- **Visibility**: Real-time inventory, profit, and cash flow dashboards
- **Control**: Prevent unauthorized discounts, track waste, manage credit limits
- **Simplicity**: No accounting knowledge required for daily operations
- **Localization**: Arabic-first interface with RTL support, local currency and tax rules

### 1.4 Non-Goals
- Advanced ERP features (manufacturing, multi-currency, consolidation)
- E-commerce platform / online marketplace integration (initially)
- Government tax filing and compliance automation
- Complex HR/payroll with benefits, time-tracking, leave management
- Multi-location inventory transfers (deferred to Phase 2)

### 1.5 Target Users
- **Owner/Manager**: Full system access, reports, strategic decisions
- **Cashier/Sales**: POS operations, daily sales, receipts
- **Purchaser/Inventory Manager**: Procurement, receiving, stock management
- **Accountant** (optional): Financial reports, reconciliation, period close

### 1.6 Key Assumptions
- Single-tenant deployment initially (multi-tenant architecture ready for SaaS)
- Local deployment preferred (desktop/LAN) with optional cloud backup
- Cash-heavy business model with some credit/account sales
- Internet connectivity may be unstable (offline-first design)
- Arabic as primary language, English as secondary
- Thermal printer, barcode scanner, and scale integration required

---

## 2. Tenant & Configuration Model

### 2.1 Multi-Tenant Architecture
The system is designed to support multiple independent tenants (clients) with complete data isolation. Each tenant represents a separate business with its own:
- Database schema (logical isolation via TenantId)
- Configuration settings
- Users and permissions
- Chart of accounts
- Product catalog
- Branding (logo, colors, shop name)

### 2.2 Vertical Configuration
Each tenant is configured for a specific **vertical** (industry type):

| Vertical | Primary Units | Key Features | Example Clients |
|----------|---------------|--------------|-----------------|
| **Retail Food** | Weight (kg), Pieces | Expiry tracking, waste management, weight-based pricing | Chicken shops, butchers, bakeries |
| **Auto Service** | Pieces, Services | Service tracking, vehicle history, periodic maintenance | Auto repair, oil change shops |
| **Retail General** | Pieces | Barcode scanning, size/color variants | Clothing, electronics, hardware |
| **Services** | Hours, Sessions | Appointment scheduling, service packages | Salons, clinics, tutoring |

### 2.3 Configurable Elements

#### 2.3.1 Business Settings
- **Shop Name** (Arabic & English)
- **Logo & Branding** (colors, receipt header)
- **Contact Info** (phone, address, email)
- **Fiscal Settings**:
  - Fiscal year start (e.g., January 1 or custom)
  - Base currency (ILS, USD, etc.)
  - Tax regime (VAT, sales tax, none)
  - Default tax rate (e.g., 17% VAT)
- **Numbering Sequences**:
  - Invoice format: `INV-{YYYY}-{0001}`
  - Purchase order format: `PO-{YYYY}-{0001}`
  - Customer/Supplier ID format

#### 2.3.2 Unit of Measure (UoM) Configuration
Supports multiple UoMs per vertical:
- **Weight**: kg, g, lb
- **Volume**: L, ml
- **Count**: pieces (pcs), dozen, carton
- **Length**: m, cm
- **Service**: hours, sessions

Each product can have:
- **Primary UoM** (e.g., kg for whole chicken)
- **Secondary UoM** (e.g., pieces for chicken breasts)
- **Conversion rules** (e.g., 1 dozen = 12 pieces)

#### 2.3.3 Tax/VAT Configuration
- **Tax Calculation Method**: Inclusive vs Exclusive
- **Tax Rates**: Per category or per item (e.g., fresh food 0%, cooked food 17%)
- **Tax Accounts**: Automatic posting to correct GL accounts

#### 2.3.4 Pricing & Costing
- **Pricing Strategy**: Markup % on cost, fixed price, tiered pricing
- **Cost Method**: FIFO (implemented), LIFO (future), Average (future)
- **Rounding Rules**: Currency precision (e.g., 0.01 ILS)

#### 2.3.5 Document Templates
- **Receipt Template**: Thermal printer (Arabic/English), includes tax breakdown
- **Invoice Template**: A4 PDF with logo, terms, payment instructions
- **Purchase Order Template**: Supplier orders
- **Reports**: Customizable headers/footers per vertical

---

## 3. Roles & Permissions

### 3.1 Role Definitions

| Role | Description | Access Level |
|------|-------------|--------------|
| **Admin/Owner** | Full system access | All modules, all operations, reports |
| **Manager** | Operational management | Sales, purchases, inventory, reports (read-only on settings) |
| **Cashier** | Front-desk sales | POS only, cannot edit prices/discounts beyond limits |
| **Purchaser** | Procurement & receiving | Purchases, inventory receiving, supplier management |
| **Accountant** | Financial oversight | Reports, reconciliation, period close (read-only on transactions) |
| **Viewer** | Read-only access | Reports and dashboards only |

### 3.2 Permission Matrix

| Operation | Admin | Manager | Cashier | Purchaser | Accountant |
|-----------|-------|---------|---------|-----------|------------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Sale | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit/Delete Sale | ✅ | ✅ | ❌ | ❌ | ❌ |
| Apply Discount > 10% | ✅ | ✅ (with approval) | ❌ | ❌ | ❌ |
| Create Purchase | ✅ | ✅ | ❌ | ✅ | ❌ |
| Receive Inventory | ✅ | ✅ | ❌ | ✅ | ❌ |
| Adjust Inventory | ✅ | ✅ | ❌ | ✅ | ❌ |
| Record Waste | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage Customers | ✅ | ✅ | ✅ (view only) | ❌ | ❌ |
| Manage Suppliers | ✅ | ✅ | ❌ | ✅ | ❌ |
| View Reports | ✅ | ✅ | ❌ | ❌ | ✅ |
| Export Data | ✅ | ✅ | ❌ | ❌ | ✅ |
| Manage Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |

### 3.3 Permission Rules
- **Discount Approval**: Discounts above configured threshold (default 10%) require manager PIN or approval
- **Price Override**: Cashiers cannot override prices below cost
- **Voiding Transactions**: Only managers can void sales after the end-of-day close
- **Credit Limits**: System enforces customer credit limits; override requires manager approval
- **Negative Inventory**: Blocked by default; can be enabled per role for specific items (e.g., made-to-order)

---

## 4. Domain Model (Data Schema)

### 4.1 Entity Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOMAIN MODEL                             │
└─────────────────────────────────────────────────────────────────┘

Master Data:
├── Item (Product/SKU)
├── Category
├── Customer
├── Supplier (Merchant)
└── User

Transactions:
├── Sale (Header)
│   └── SaleLine (Detail)
│       └── SaleLineCostAllocation (FIFO tracking)
├── Purchase (Header)
│   └── PurchaseLine (Detail)
├── Payment
└── PersonalExpense

Inventory & Costing:
├── Inventory (Current stock)
├── InventoryLot (FIFO batches)
├── StockMovement (Audit trail)
└── InventoryAdjustment (Waste, shrinkage, corrections)

Accounting:
├── Debt (Receivables & Payables)
└── SalesProfit (Aggregated profit tracking)

System:
├── SystemSetting (Configuration KV store)
└── RefreshToken (Authentication)
```

---

### 4.2 Core Entities

#### 4.2.1 Item (Product/SKU)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Name | string(200) | NOT NULL | Item name (e.g., "Whole Chicken", "Chicken Breast") |
| NameEn | string(200) | NULL | English name (optional) |
| CategoryId | GUID | FK → Category | Product category |
| Barcode | string(50) | UNIQUE, NULL | EAN/UPC barcode |
| PrimaryUoM | enum | NOT NULL | kg, pieces, liters, etc. |
| PurchasePrice | decimal(18,2) | NOT NULL | Last/average purchase cost |
| DefaultSalePrice | decimal(18,2) | NOT NULL | Standard selling price |
| MinQuantity | int | DEFAULT 0 | Low-stock alert threshold |
| IsWeightBased | bool | DEFAULT false | If true, requires scale integration |
| IsPerishable | bool | DEFAULT false | If true, tracks expiry dates |
| DefaultExpiryDays | int | NULL | Default shelf life (for perishable items) |
| IsActive | bool | DEFAULT true | Soft delete flag |
| CreatedAt | datetime | NOT NULL | Audit: creation timestamp |
| UpdatedAt | datetime | NULL | Audit: last update timestamp |

**Indexes**: `Name`, `Barcode`, `CategoryId`, `IsActive`

**Relationships**:
- `Category` (Many-to-One)
- `PurchaseLines`, `SaleLines`, `InventoryLots` (One-to-Many)

---

#### 4.2.2 Category

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Name | string(100) | NOT NULL | Category name (e.g., "Fresh Chicken", "Frozen", "Extras") |
| NameEn | string(100) | NULL | English name |
| ParentId | GUID | FK → Category, NULL | For hierarchical categories |
| TaxRate | decimal(5,2) | NULL | Category-level tax rate override |
| SortOrder | int | DEFAULT 0 | Display order in UI |

**Example Vertical Mappings**:
- **Chicken Shop**: Fresh, Cut-Up, Frozen, Cooked, Extras (spices, bags)
- **Auto Service**: Parts, Lubricants, Filters, Labor/Services
- **Retail General**: Clothing, Electronics, Home Goods

---

#### 4.2.3 Customer

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Name | string(200) | NOT NULL | Customer full name |
| PhoneNumber | string(20) | NOT NULL, UNIQUE | Primary contact |
| Email | string(100) | NULL | Email address |
| Address | string(500) | NULL | Street address |
| CreditLimit | decimal(18,2) | DEFAULT 0 | Maximum allowed outstanding balance |
| CurrentBalance | decimal(18,2) | COMPUTED | Sum of unpaid debts (Owed_To_Me) |
| Notes | text | NULL | Additional notes |
| IsActive | bool | DEFAULT true | Soft delete flag |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Indexes**: `PhoneNumber` (UNIQUE), `Name`

**Relationships**:
- `Sales`, `Debts` (One-to-Many)
- `ServiceRecords` (One-to-Many, vertical-specific)

---

#### 4.2.4 Supplier (Merchant)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Name | string(200) | NOT NULL | Supplier/vendor name |
| PhoneNumber | string(20) | NOT NULL | Primary contact |
| Email | string(100) | NULL | Email address |
| Address | string(500) | NULL | Street address |
| PaymentTerms | string(100) | NULL | e.g., "Net 30", "COD" |
| CurrentBalance | decimal(18,2) | COMPUTED | Sum of unpaid debts (I_Owe) |
| Notes | text | NULL | Additional notes |
| IsActive | bool | DEFAULT true | Soft delete flag |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Indexes**: `PhoneNumber`, `Name`

**Relationships**:
- `Purchases`, `Debts` (One-to-Many)

---

#### 4.2.5 Sale (Transaction Header)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| SaleNumber | string(50) | UNIQUE, NOT NULL | Human-readable invoice number |
| CustomerId | GUID | FK → Customer, NULL | If null, walk-in customer |
| CustomerName | string(200) | NOT NULL | Captured at sale time (denormalized) |
| CustomerPhone | string(20) | NOT NULL | Captured at sale time |
| SaleDate | datetime | NOT NULL | Transaction date/time |
| GrossTotalAmount | decimal(18,2) | NOT NULL | Sum before discounts |
| DiscountTotalAmount | decimal(18,2) | DEFAULT 0 | Total discounts applied |
| TotalAmount | decimal(18,2) | NOT NULL | Net amount due (Gross - Discount) |
| TotalCost | decimal(18,2) | NOT NULL | FIFO-calculated COGS |
| TotalProfit | decimal(18,2) | COMPUTED | TotalAmount - TotalCost |
| TaxAmount | decimal(18,2) | DEFAULT 0 | VAT/tax amount |
| PaymentStatus | enum | NOT NULL | Unpaid, PartiallyPaid, Paid |
| DueDate | datetime | NULL | Payment due date (for credit sales) |
| Notes | text | NULL | Sale notes |
| CashierId | GUID | FK → User, NULL | User who processed the sale |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Indexes**: `SaleNumber` (UNIQUE), `CustomerId`, `SaleDate`, `PaymentStatus`

**Relationships**:
- `SaleLines`, `Payments`, `Debts` (One-to-Many)

---

#### 4.2.6 SaleLine (Transaction Detail)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| SaleId | GUID | FK → Sale, NOT NULL | Parent sale |
| ItemId | GUID | FK → Item, NOT NULL | Product sold |
| Quantity | decimal(18,3) | NOT NULL | Quantity sold (supports fractional for weight) |
| UoM | enum | NOT NULL | Unit of measure (kg, pieces, etc.) |
| UnitSalePrice | decimal(18,2) | NOT NULL | Price before discount |
| UnitNetSalePrice | decimal(18,2) | NOT NULL | Price after discount |
| UnitPurchasePrice | decimal(18,2) | NOT NULL | Average cost from FIFO (for display) |
| LineTotal | decimal(18,2) | COMPUTED | Quantity * UnitNetSalePrice |
| LineCost | decimal(18,2) | COMPUTED | Sum from SaleLineCostAllocations |
| LineProfit | decimal(18,2) | COMPUTED | LineTotal - LineCost |

**Indexes**: `SaleId`, `ItemId`

**Relationships**:
- `Sale`, `Item` (Many-to-One)
- `SaleLineCostAllocations` (One-to-Many)

---

#### 4.2.7 SaleLineCostAllocation (FIFO Tracking)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| SaleId | GUID | FK → Sale, NOT NULL | Parent sale |
| SaleLineId | GUID | FK → SaleLine, NOT NULL | Parent sale line |
| InventoryLotId | GUID | FK → InventoryLot, NOT NULL | Lot from which cost is drawn |
| Quantity | int | NOT NULL | Quantity consumed from this lot |
| UnitPurchasePrice | decimal(18,2) | NOT NULL | Cost per unit from this lot |

**Purpose**: Tracks exactly which inventory lots (FIFO batches) were consumed for each sale line, enabling accurate COGS calculation.

**Indexes**: `SaleId`, `SaleLineId`, `InventoryLotId`

---

#### 4.2.8 Purchase (Transaction Header)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| PurchaseNumber | string(50) | UNIQUE, NOT NULL | Human-readable PO number |
| SupplierId | GUID | FK → Supplier, NOT NULL | Vendor |
| PurchaseDate | datetime | NOT NULL | Purchase order date |
| TotalAmount | decimal(18,2) | NOT NULL | Total purchase value |
| TaxAmount | decimal(18,2) | DEFAULT 0 | VAT/tax amount |
| PaymentStatus | enum | NOT NULL | Unpaid, PartiallyPaid, Paid |
| DueDate | datetime | NULL | Payment due date |
| Notes | text | NULL | Purchase notes |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Indexes**: `PurchaseNumber` (UNIQUE), `SupplierId`, `PurchaseDate`, `PaymentStatus`

**Relationships**:
- `PurchaseLines`, `Payments`, `Debts`, `InventoryLots` (One-to-Many)

---

#### 4.2.9 PurchaseLine (Transaction Detail)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| PurchaseId | GUID | FK → Purchase, NOT NULL | Parent purchase |
| ItemId | GUID | FK → Item, NOT NULL | Product purchased |
| Quantity | decimal(18,3) | NOT NULL | Quantity purchased |
| UoM | enum | NOT NULL | Unit of measure |
| UnitPurchasePrice | decimal(18,2) | NOT NULL | Cost per unit |
| UnitSalePrice | decimal(18,2) | NULL | Suggested selling price (optional) |
| LineTotal | decimal(18,2) | COMPUTED | Quantity * UnitPurchasePrice |
| ExpiryDate | datetime | NULL | For perishable items |

**Indexes**: `PurchaseId`, `ItemId`

**Relationships**:
- `Purchase`, `Item` (Many-to-One)
- `InventoryLot` (One-to-One, created automatically on purchase)

---

#### 4.2.10 InventoryLot (FIFO Batch)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| ItemId | GUID | FK → Item, NOT NULL | Product |
| PurchaseId | GUID | FK → Purchase, NULL | Source purchase (null for opening stock) |
| PurchaseLineId | GUID | FK → PurchaseLine, NULL | Source purchase line |
| TotalQuantity | int | NOT NULL | Original quantity received |
| RemainingQuantity | int | NOT NULL | Available quantity (decremented on sale) |
| UnitPurchasePrice | decimal(18,2) | NOT NULL | Cost per unit |
| ReceivedAt | datetime | NOT NULL | Receipt timestamp (for FIFO ordering) |
| ExpiryDate | datetime | NULL | For perishable items |

**Purpose**: Each purchase creates a new lot. Sales consume lots in FIFO order (oldest first).

**Indexes**: `ItemId`, `ReceivedAt` (for FIFO ordering), `RemainingQuantity`

**Relationships**:
- `Item`, `Purchase`, `PurchaseLine` (Many-to-One)
- `SaleLineCostAllocations` (One-to-Many)

---

#### 4.2.11 Inventory (Current Stock Summary)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| ItemId | GUID | FK → Item, UNIQUE, NOT NULL | Product (one row per item) |
| CurrentQuantity | int | NOT NULL | Real-time stock level |
| ShelfLocation | string(50) | NULL | Physical location (e.g., "A3", "Freezer-B") |
| LastRestockDate | datetime | NULL | Last received date |
| LastUpdateDate | datetime | NOT NULL | Last change timestamp |

**Purpose**: Aggregated view of current stock. Updated automatically on purchases, sales, adjustments.

**Indexes**: `ItemId` (UNIQUE), `CurrentQuantity`

**Relationships**:
- `Item` (One-to-One)

---

#### 4.2.12 StockMovement (Audit Trail)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| ItemId | GUID | FK → Item, NOT NULL | Product |
| Quantity | int | NOT NULL | Positive for inbound, negative for outbound |
| MovementType | enum | NOT NULL | Purchase, Sale, Adjustment, Transfer, Waste |
| ReferenceType | enum | NOT NULL | Sale, Purchase, Adjustment, etc. |
| ReferenceId | GUID | NULL | FK to source transaction |
| Notes | text | NULL | Reason for adjustment/waste |
| CreatedAt | datetime | NOT NULL | Movement timestamp |
| UserId | GUID | FK → User, NULL | User who recorded the movement |

**Purpose**: Immutable audit log of all inventory changes.

**Indexes**: `ItemId`, `CreatedAt`, `ReferenceType`

---

#### 4.2.13 Payment

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| ReferenceType | enum | NOT NULL | Sale, Purchase |
| ReferenceId | GUID | NOT NULL | FK to Sale or Purchase |
| AmountPaid | decimal(18,2) | NOT NULL | Payment amount |
| PaymentMethod | enum | NOT NULL | Cash, Card, BankTransfer, Mobile |
| PaymentDate | datetime | NOT NULL | Payment timestamp |
| Notes | text | NULL | Payment notes |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Indexes**: `ReferenceType`, `ReferenceId`, `PaymentDate`

**Relationships**:
- Polymorphic FK to `Sale` or `Purchase`

---

#### 4.2.14 Debt (Receivables & Payables)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Direction | enum | NOT NULL | Owed_To_Me (receivable), I_Owe (payable) |
| CustomerId | GUID | FK → Customer, NULL | If Direction = Owed_To_Me |
| SupplierId | GUID | FK → Supplier, NULL | If Direction = I_Owe |
| PartyName | string(200) | NULL | Denormalized name |
| TotalAmount | decimal(18,2) | NOT NULL | Outstanding balance |
| DueDate | datetime | NULL | Payment due date |
| Note | text | NULL | Reference note (e.g., "Sale:GUID") |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Purpose**: Tracks all outstanding receivables (customer credit) and payables (supplier credit).

**Indexes**: `Direction`, `CustomerId`, `SupplierId`, `DueDate`

**Relationships**:
- `Customer`, `Supplier` (Many-to-One)

---

#### 4.2.15 PersonalExpense

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Amount | decimal(18,2) | NOT NULL | Expense amount |
| PayeeName | string(200) | NOT NULL | To whom payment was made |
| ExpenseCategory | string(100) | NULL | e.g., Rent, Utilities, Salaries, Supplies |
| PaymentMethod | enum | NOT NULL | Cash, Card, BankTransfer |
| Notes | text | NULL | Expense description |
| ExpenseDate | datetime | NOT NULL | Expense date |
| CreatedAt | datetime | NOT NULL | Audit timestamp |
| UserId | GUID | FK → User, NULL | User who recorded expense |

**Purpose**: Tracks owner/shop personal expenses (rent, utilities, salaries, etc.) for profit calculation.

**Indexes**: `ExpenseDate`, `ExpenseCategory`

---

#### 4.2.16 User

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| UserName | string(50) | UNIQUE, NOT NULL | Login username |
| PasswordHash | string(500) | NOT NULL | Hashed password |
| Email | string(100) | NULL | Email address |
| FullName | string(200) | NOT NULL | Display name |
| Role | enum | NOT NULL | Admin, Manager, Cashier, Purchaser, Accountant |
| IsActive | bool | DEFAULT true | Account status |
| CreatedAt | datetime | NOT NULL | Audit timestamp |

**Indexes**: `UserName` (UNIQUE), `Role`

---

#### 4.2.17 SystemSetting (Configuration Store)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier |
| Key | string(100) | UNIQUE, NOT NULL | Setting key (e.g., "ShopNameAr", "LogoUrl") |
| Value | text | NULL | Setting value (JSON for complex configs) |
| UpdatedAt | datetime | NOT NULL | Last update timestamp |

**Purpose**: Key-value store for system-wide configuration (shop name, logo, tax rates, etc.)

---

#### 4.2.18 SalesProfit (Aggregated Tracking)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| Id | GUID | PK | Unique identifier (singleton row) |
| TotalProfit | decimal(18,2) | NOT NULL | Cumulative sales profit |
| UpdatedAt | datetime | NOT NULL | Last update timestamp |

**Purpose**: Single-row table that aggregates total profit for dashboard. Updated on each sale creation/edit/delete.

---

### 4.3 Relationships Diagram

```
┌─────────────┐
│  Category   │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐       ┌──────────────┐
│    Item     │◄──────┤  Inventory   │
└──────┬──────┘  1:1  └──────────────┘
       │
       │ 1:N
       ▼
┌──────────────────┐       ┌─────────────┐
│  InventoryLot    │◄──────┤  Purchase   │
└────────┬─────────┘  1:N  │             │
         │                 │ PurchaseId  │
         │                 └──────┬──────┘
         │ 1:N                    │
         │                        │ 1:N
         │                        ▼
         │                 ┌──────────────┐
         │                 │ PurchaseLine │
         │                 └──────┬───────┘
         │                        │
         │                        │ 1:1
         │                        ▼
         │                 ┌──────────────┐
         └────────────────►│InventoryLot  │
                           └──────────────┘

┌──────────────┐       ┌─────────────┐
│   Customer   │◄──────┤    Sale     │
└──────┬───────┘  1:N  │             │
       │               │   SaleId    │
       │               └──────┬──────┘
       │                      │
       │ 1:N                  │ 1:N
       │                      ▼
       │               ┌──────────────┐
       │               │  SaleLine    │
       │               └──────┬───────┘
       │                      │
       │                      │ 1:N
       │                      ▼
       │               ┌──────────────────────┐
       │               │SaleLineCostAllocation│
       │               └───────────┬──────────┘
       │                           │
       │                           │ N:1
       │                           ▼
       │                    ┌──────────────┐
       │                    │InventoryLot  │
       │                    └──────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│     Debt     │
│  (Direction: │
│ Owed_To_Me)  │
└──────────────┘

┌──────────────┐       ┌─────────────┐
│   Supplier   │◄──────┤  Purchase   │
└──────┬───────┘  1:N  └─────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│     Debt     │
│  (Direction: │
│    I_Owe)    │
└──────────────┘

┌──────────────┐
│   Payment    │ (polymorphic to Sale or Purchase)
└──────────────┘
```

---

## 5. Core Workflows

### 5.1 Procurement & Receiving Workflow

#### 5.1.1 Create Purchase Order
1. **Navigate**: Purchasing → New Purchase
2. **Select Supplier**: Choose from dropdown or create new
3. **Add Line Items**:
   - Search/scan item
   - Enter quantity and unit purchase price
   - Optionally set suggested sale price
   - For perishable items, enter expiry date
4. **Enter Payment Terms**:
   - Paid amount (full or partial)
   - Due date for remaining balance
5. **Save**: System automatically:
   - Creates `Purchase` record with lines
   - Creates `InventoryLot` for each line (with `RemainingQuantity = Quantity`)
   - Updates `Inventory.CurrentQuantity` (+Quantity)
   - Creates `StockMovement` records (type: Purchase)
   - Creates `Debt` record if remaining balance > 0 (Direction: I_Owe)
   - Creates `Payment` record if paid amount > 0

#### 5.1.2 Record Payment on Purchase
1. **Navigate**: Purchasing → Purchase Details → Payments tab
2. **Add Payment**:
   - Enter amount (cannot exceed remaining balance)
   - Select payment method
   - Enter payment date
3. **Save**: System automatically:
   - Creates `Payment` record
   - Updates `Purchase.PaymentStatus` (Unpaid → PartiallyPaid → Paid)
   - Updates `Debt.TotalAmount` (reduces or deletes if fully paid)

#### 5.1.3 Edit Purchase (Before Payment)
- **Restriction**: Cannot edit if any payments exist
- **Process**: Deletes old lines, restores inventory, recreates lines with new data

#### 5.1.4 Delete Purchase (Before Payment)
- **Restriction**: Cannot delete if any payments exist
- **Process**:
  - Deletes `InventoryLots` (only if `RemainingQuantity = TotalQuantity`, i.e., not consumed by sales)
  - Reverses `Inventory.CurrentQuantity` (-Quantity)
  - Deletes `StockMovement` records
  - Deletes `Debt` record

---

### 5.2 Inventory Management Workflow

#### 5.2.1 View Current Stock
- **Dashboard**: Low Stock Alerts widget
- **Inventory Page**: Filterable table with columns:
  - Item Name, Category, Current Quantity, Min Quantity, Status (In Stock / Low / Out of Stock), Shelf Location
- **Color Coding**:
  - Green: Quantity > MinQuantity
  - Yellow: Quantity ≤ MinQuantity
  - Red: Quantity = 0

#### 5.2.2 Record Waste/Shrinkage
1. **Navigate**: Inventory → Item Details → Adjustments → Record Waste
2. **Enter Details**:
   - Quantity to write off
   - Reason (dropdown + free text): Spoilage, Trimming Loss, Damage, Expired
   - Date
3. **Save**: System automatically:
   - Reduces `Inventory.CurrentQuantity`
   - Consumes oldest `InventoryLots` (FIFO) and reduces `RemainingQuantity`
   - Creates `StockMovement` (type: Waste) with negative quantity
   - **Does NOT affect profit** (COGS already incurred on purchase)

#### 5.2.3 Manual Stock Adjustment
1. **Navigate**: Inventory → Item Details → Adjustments → Manual Adjustment
2. **Enter**:
   - Adjustment type: Increase or Decrease
   - Quantity
   - Reason (Cycle Count Correction, Theft, Found Stock, etc.)
3. **Save**:
   - If **Increase**: Creates new `InventoryLot` with zero cost (or prompts for cost if significant)
   - If **Decrease**: Consumes lots via FIFO
   - Creates `StockMovement` (type: Adjustment)

#### 5.2.4 Transfer Between Locations (Future)
- **Note**: Currently single-location. Multi-location transfers (e.g., from warehouse to shop floor) deferred to Phase 2.

---

### 5.3 Sales (POS) Workflow

#### 5.3.1 Create Sale
1. **Navigate**: Sales → New Sale (or POS shortcut)
2. **Add Items to Cart**:
   - **Method 1**: Scan barcode → auto-adds item
   - **Method 2**: Search by name → select item
   - **Method 3**: Quick buttons for common items (configurable)
3. **For Each Item**:
   - If **weight-based**: Connect scale → reads weight → calculates price (weight × unit price)
   - If **piece-based**: Enter quantity manually
   - Adjust quantity if needed
   - Apply line-level discount (if permitted by role)
4. **Apply Sale-Level Discount** (optional):
   - Percentage or fixed amount
   - If discount > threshold, prompt for manager approval (PIN or approval code)
5. **Select Customer**:
   - Walk-in (anonymous): Enter name & phone
   - Existing: Search by phone → auto-fills name
6. **Enter Payment**:
   - **Full Payment**: Enter amount ≥ total → status = Paid
   - **Partial Payment**: Enter amount < total → status = PartiallyPaid, creates debt
   - **Credit/Account**: Amount = 0 → status = Unpaid, creates debt
   - For credit sales: Enter due date
   - Select payment method: Cash, Card, Mobile Payment
7. **Save**: System automatically:
   - Creates `Sale` record with lines
   - **FIFO Cost Allocation**:
     - For each sale line, finds oldest `InventoryLots` with `RemainingQuantity > 0`
     - Creates `SaleLineCostAllocation` records linking line to lots
     - Reduces `InventoryLot.RemainingQuantity`
   - Calculates `TotalCost` and `TotalProfit` (TotalAmount - TotalCost)
   - Updates `Inventory.CurrentQuantity` (-Quantity)
   - Creates `StockMovement` records (type: Sale, negative quantity)
   - Updates `SalesProfit.TotalProfit` (+TotalProfit)
   - Creates `Payment` record if paid amount > 0
   - Creates `Debt` record if remaining balance > 0 (Direction: Owed_To_Me)
8. **Print Receipt**: Sends to thermal printer (configurable: auto-print or manual)

#### 5.3.2 Record Additional Payment on Sale
1. **Navigate**: Sales → Sale Details → Payments tab
2. **Add Payment**: (same as purchase payment flow)
3. **Save**: System updates `PaymentStatus` and `Debt` accordingly

#### 5.3.3 Edit Sale (Before Payment)
- **Restriction**: Cannot edit if any payments exist
- **Process**:
  - Restores old `InventoryLots` (adds back consumed quantities)
  - Deletes old `SaleLineCostAllocations`
  - Reverses inventory and stock movements
  - Reverses profit from `SalesProfit`
  - Recreates sale with new data

#### 5.3.4 Delete Sale (Before Payment)
- **Restriction**: Cannot delete if any payments exist
- **Process**: Same as edit, but removes sale entirely

#### 5.3.5 Void/Return Sale (After Payment)
- **Note**: Currently not implemented. Recommended approach for Phase 2:
  - Create `SaleReturn` entity (new transaction type)
  - Reverses inventory, refunds payment, creates negative sale profit
  - Original sale remains immutable for audit

---

### 5.4 Payments & Collections Workflow

#### 5.4.1 View Outstanding Debts
- **Dashboard**: Customer Debts widget (Owed_To_Me), Supplier Debts widget (I_Owe)
- **Customers Page**: Each customer shows `CurrentBalance` (sum of debts)
- **Suppliers Page**: Each supplier shows `CurrentBalance` (sum of debts)

#### 5.4.2 Collect Payment from Customer
1. **Navigate**: Customers → Customer Details → Outstanding Debts
2. **Select Sale**: Click on unpaid/partial sale
3. **Add Payment**: (same flow as 5.3.2)

#### 5.4.3 Pay Supplier
1. **Navigate**: Traders → Supplier Details → Outstanding Debts
2. **Select Purchase**: Click on unpaid/partial purchase
3. **Add Payment**: (same flow as 5.1.2)

---

### 5.5 Personal Expenses Workflow

#### 5.5.1 Record Expense
1. **Navigate**: Personal Expenses → New Expense
2. **Enter Details**:
   - Payee name (e.g., landlord, electric company, employee)
   - Amount
   - Category (Rent, Utilities, Salaries, Supplies, etc.)
   - Payment method
   - Expense date
   - Notes
3. **Save**: Creates `PersonalExpense` record

#### 5.5.2 View Expenses
- **List**: Filterable by date range, category, payee
- **Export**: CSV/Excel for accounting

---

### 5.6 Period Close & Adjustments Workflow

#### 5.6.1 End-of-Day Close
1. **Navigate**: Dashboard → End of Day (or POS → Close Shift)
2. **System Generates Z-Report**:
   - Total sales count and amount (by payment method)
   - Total payments received (by method)
   - Cash drawer expected vs actual (prompts for actual count)
   - Variance (over/short)
3. **Cashier Confirms**: Locks day (optional: prevents editing past sales)
4. **Print Z-Report**: Staple to cash receipts for deposit

#### 5.6.2 Month-End Close (Future)
- Generates financial statements (P&L, Balance Sheet)
- Optionally locks period (prevents backdated transactions)
- Exports to external accounting system (if configured)

---

## 6. Accounting & Ledger Logic

### 6.1 Cost of Goods Sold (COGS) Calculation

#### 6.1.1 FIFO Method (Implemented)
**Principle**: First In, First Out. Inventory is sold in the order it was purchased.

**Process**:
1. Each purchase creates an `InventoryLot` with `TotalQuantity` and `RemainingQuantity`
2. On sale, system finds oldest lots (ordered by `ReceivedAt ASC`)
3. Consumes from each lot sequentially until sale quantity is satisfied
4. Creates `SaleLineCostAllocation` records linking sale line to lots
5. Calculates `LineCost` = sum of (lot.UnitPurchasePrice × allocation.Quantity)
6. `TotalCost` = sum of all line costs
7. `TotalProfit` = `TotalAmount` - `TotalCost`

**Example** (Chicken Shop):
```
Purchase 1 (Day 1): 100 kg @ 10 ILS/kg → Lot A (RemainingQuantity = 100)
Purchase 2 (Day 3): 100 kg @ 12 ILS/kg → Lot B (RemainingQuantity = 100)

Sale 1 (Day 4): 150 kg @ 20 ILS/kg
- Consume 100 kg from Lot A (oldest) → Cost = 100 × 10 = 1000 ILS
- Consume 50 kg from Lot B → Cost = 50 × 12 = 600 ILS
- Total Cost = 1600 ILS
- Total Revenue = 150 × 20 = 3000 ILS
- Profit = 3000 - 1600 = 1400 ILS
```

#### 6.1.2 Inventory Valuation
- **Balance Sheet**: Inventory value = sum of (InventoryLot.RemainingQuantity × UnitPurchasePrice) across all lots
- **Profit Impact**: FIFO means older, cheaper inventory is expensed first → higher profit in inflationary periods

#### 6.1.3 Future Methods (Not Implemented)
- **LIFO** (Last In, First Out): Opposite of FIFO, sells newest inventory first
- **Weighted Average**: Average cost across all lots, recalculated on each purchase
- **Standard Cost**: Fixed cost per item, adjusted periodically

---

### 6.2 Accounting Entries (Implicit)

The system does **not** implement a full double-entry ledger with journal entries. Instead, it uses **denormalized transaction tables** that implicitly represent accounting postings. For integration with external accounting systems, the following mappings apply:

#### 6.2.1 Sale Transaction Posting

| Account | Debit | Credit | Notes |
|---------|-------|--------|-------|
| **Cash** (or **Accounts Receivable** if credit) | TotalAmount | - | Asset increase |
| **Sales Revenue** | - | TotalAmount | Income increase |
| **Cost of Goods Sold (COGS)** | TotalCost | - | Expense increase |
| **Inventory** | - | TotalCost | Asset decrease |

**Net Effect**: Increase cash/AR, decrease inventory, increase revenue, increase COGS.

#### 6.2.2 Purchase Transaction Posting

| Account | Debit | Credit | Notes |
|---------|-------|--------|-------|
| **Inventory** | TotalAmount | - | Asset increase |
| **Cash** (or **Accounts Payable** if credit) | - | TotalAmount | Asset decrease or liability increase |

#### 6.2.3 Payment Transaction Posting

**For Sale Payment** (reduce receivable):

| Account | Debit | Credit | Notes |
|---------|-------|--------|-------|
| **Cash** | AmountPaid | - | Asset increase |
| **Accounts Receivable** | - | AmountPaid | Asset decrease |

**For Purchase Payment** (reduce payable):

| Account | Debit | Credit | Notes |
|---------|-------|--------|-------|
| **Accounts Payable** | AmountPaid | - | Liability decrease |
| **Cash** | - | AmountPaid | Asset decrease |

#### 6.2.4 Expense Transaction Posting

| Account | Debit | Credit | Notes |
|---------|-------|--------|-------|
| **Expense Account** (Rent, Utilities, etc.) | Amount | - | Expense increase |
| **Cash** | - | Amount | Asset decrease |

#### 6.2.5 Waste/Shrinkage Posting

| Account | Debit | Credit | Notes |
|---------|-------|--------|-------|
| **COGS** (or **Shrinkage Expense**) | Cost | - | Expense increase |
| **Inventory** | - | Cost | Asset decrease |

**Note**: In current implementation, waste reduces inventory but does NOT create an explicit expense entry (cost was already incurred on purchase). For accounting purposes, waste should reduce inventory valuation and increase COGS or a separate Shrinkage account.

---

### 6.3 Tax/VAT Handling

#### 6.3.1 Tax Calculation Methods

**1. Inclusive Pricing** (Price includes tax):
- Display Price = Price with tax embedded
- Tax Amount = Display Price × (TaxRate / (1 + TaxRate))
- Net Amount = Display Price - Tax Amount
- Example: 117 ILS display price with 17% VAT → Net = 100 ILS, Tax = 17 ILS

**2. Exclusive Pricing** (Tax added on top):
- Display Price = Net price before tax
- Tax Amount = Display Price × TaxRate
- Total Amount = Display Price + Tax Amount
- Example: 100 ILS net with 17% VAT → Tax = 17 ILS, Total = 117 ILS

**Configuration**: Set per tenant or per item category.

#### 6.3.2 Tax Reporting
- **Sales Tax Collected**: Sum of `Sale.TaxAmount` (liability to government)
- **Purchase Tax Paid**: Sum of `Purchase.TaxAmount` (credit from government)
- **Net Tax Due**: Sales Tax Collected - Purchase Tax Paid

**Report**: Tax Summary Report (monthly, quarterly) for submission to tax authority.

---

### 6.4 Chart of Accounts Template

Below is a **generalized chart of accounts** template suitable for small retail/service businesses. Each tenant can customize account names and structure.

#### Asset Accounts (1000-1999)

| Code | Name | Type | Description |
|------|------|------|-------------|
| 1100 | Cash on Hand | Asset | Physical cash in register/safe |
| 1200 | Bank Account | Asset | Business bank account |
| 1300 | Accounts Receivable | Asset | Customer debts (credit sales) |
| 1400 | Inventory | Asset | Current stock value (at cost) |
| 1500 | Prepaid Expenses | Asset | Prepaid rent, insurance, etc. |
| 1800 | Fixed Assets | Asset | Equipment, furniture, vehicles |

#### Liability Accounts (2000-2999)

| Code | Name | Type | Description |
|------|------|------|-------------|
| 2100 | Accounts Payable | Liability | Supplier debts (credit purchases) |
| 2200 | VAT Payable | Liability | Sales tax collected, owed to government |
| 2300 | Loans Payable | Liability | Business loans |

#### Equity Accounts (3000-3999)

| Code | Name | Type | Description |
|------|------|------|-------------|
| 3100 | Owner's Equity | Equity | Owner's investment |
| 3900 | Retained Earnings | Equity | Cumulative profit/loss |

#### Revenue Accounts (4000-4999)

| Code | Name | Type | Description |
|------|------|------|-------------|
| 4100 | Sales Revenue | Income | Product sales |
| 4200 | Service Revenue | Income | Service fees (e.g., labor in auto shop) |
| 4900 | Other Income | Income | Miscellaneous income |

#### Expense Accounts (5000-5999)

| Code | Name | Type | Description |
|------|------|------|-------------|
| 5100 | Cost of Goods Sold (COGS) | Expense | Direct cost of products sold |
| 5200 | Shrinkage/Waste | Expense | Spoilage, theft, loss |
| 5300 | Salaries & Wages | Expense | Employee compensation |
| 5400 | Rent | Expense | Shop rent |
| 5500 | Utilities | Expense | Electricity, water, gas |
| 5600 | Supplies | Expense | Consumables (bags, cleaning, etc.) |
| 5700 | Repairs & Maintenance | Expense | Equipment repairs |
| 5800 | Marketing | Expense | Advertising, promotions |
| 5900 | Miscellaneous Expense | Expense | Other expenses |

#### Chicken Shop Specific Mapping Examples:
- **Fresh Chicken Sales** → 4100 Sales Revenue
- **Cooked Chicken Sales** → 4100 Sales Revenue (or separate 4110 Cooked Food Revenue)
- **Spoilage** → 5200 Shrinkage/Waste
- **Trimming Loss** → 5200 Shrinkage/Waste (or 5100 COGS if considered normal loss)
- **Employee Salaries** → 5300 Salaries & Wages
- **Butcher Supplies (knives, bags)** → 5600 Supplies

#### Auto Service Specific Mapping Examples:
- **Parts Sales** → 4100 Sales Revenue
- **Labor/Service Fees** → 4200 Service Revenue
- **Parts Cost** → 5100 COGS
- **Shop Equipment Repairs** → 5700 Repairs & Maintenance

---

### 6.5 Refunds & Credit Notes Handling

**Current Implementation**: Not fully implemented. Recommended approach for Phase 2:

#### 6.5.1 Sale Return Process
1. **Create Return Transaction**:
   - `SaleReturn` entity (new table, mirrors `Sale` structure)
   - Links to original `Sale.Id`
   - Negative quantities
2. **Inventory Reversal**:
   - Restores inventory (creates new `InventoryLot` or re-adds to original lot if feasible)
   - Creates positive `StockMovement`
3. **Financial Reversal**:
   - Reduces `SalesProfit.TotalProfit` by return amount
   - Creates negative `Payment` (refund) or credit note applied to customer account
4. **Accounting**: Reverses original sale entries

#### 6.5.2 Purchase Return Process
- Similar to sale return, but reverses purchase and payable

---

### 6.6 Auditability Rules

#### 6.6.1 Immutable Transactions
- **Rule**: Once a transaction has payments, it becomes **immutable**
- **Rationale**: Prevents manipulation of financials after cash has changed hands
- **Implementation**: Edit/Delete operations check for payments and throw error if any exist

#### 6.6.2 Audit Trail
- **BaseEntity**: All entities inherit `CreatedAt`, `UpdatedAt`, `CreatedBy` (optional)
- **StockMovement**: Immutable log of all inventory changes with timestamps and user
- **Payment**: Immutable log of all payment transactions
- **Change Log** (Future): Track field-level changes for critical entities (Sale, Purchase, Inventory)

#### 6.6.3 Reversals Instead of Deletion
- **Recommended**: For posted transactions, use reversing entries instead of deletion
- **Example**: Instead of deleting a sale, create a negative sale (return) that offsets it
- **Benefit**: Maintains complete audit trail

---

## 7. UI/UX Requirements

### 7.1 Sidebar Structure (Navigation)

The sidebar groups pages into logical modules:

```
┌─────────────────────────────────────┐
│ 🏠 Dashboard (لوحة التحكم)          │
│                                      │
│ 📦 Inventory (المخزون)              │
│   ├─ Items (العناصر)                │
│   ├─ Categories (الفئات)            │
│   └─ Adjustments (التعديلات)        │
│                                      │
│ 🛒 Sales (البيع)                     │
│   ├─ POS (نقطة البيع)               │
│   └─ Sales History (سجل المبيعات)   │
│                                      │
│ 🛍️ Purchasing (الشراء)              │
│   ├─ Purchase Orders (أوامر الشراء) │
│   └─ Receive Stock (استلام البضاعة) │
│                                      │
│ 👥 Customers (الزبائن)               │
│   ├─ Customer List (قائمة الزبائن)  │
│   └─ Credit Accounts (الحسابات)     │
│                                      │
│ 🏪 Suppliers (التجار)                │
│   ├─ Supplier List (قائمة التجار)   │
│   └─ Payables (المستحقات)           │
│                                      │
│ 📊 Reports (التقارير)                │
│   ├─ Sales Reports (تقارير المبيعات)│
│   ├─ Inventory Reports (المخزون)    │
│   ├─ Financial Reports (المالية)    │
│   └─ Tax Reports (الضرائب)          │
│                                      │
│ 💰 Personal Expenses (المصاريف)      │
│                                      │
│ ⚙️ Settings (الإعدادات)             │
│   ├─ Shop Settings (إعدادات المحل)  │
│   ├─ Users (المستخدمين)             │
│   ├─ Categories (الفئات)            │
│   └─ Printers (الطابعات)           │
│                                      │
│ 🚪 Logout (تسجيل الخروج)            │
└─────────────────────────────────────┘
```

**Notes**:
- **Collapsible Groups**: Inventory, Sales, Purchasing, Reports (expand/collapse on click)
- **Active State**: Highlight current page in blue/accent color
- **Icon + Text**: Icons (Lucide React) + Arabic text
- **Responsive**: Collapse to icon-only on narrow screens

---

### 7.2 Page-by-Page Requirements

#### 7.2.1 Dashboard Page (`/`)

**Purpose**: At-a-glance business health summary.

**Layout**: Grid of cards (responsive: 4 columns desktop, 2 columns tablet, 1 column mobile)

**Summary Cards**:
1. **Total Customers** (عدد الزبائن): Count + icon
2. **Total Inventory Items** (عدد العناصر): Count + icon
3. **Sales Profit** (أرباح المبيعات): Amount in ILS (from `SalesProfit` table)
4. **Service Revenue** (إيرادات الخدمات): Amount (vertical-specific, e.g., maintenance revenue for auto service)
5. **Low Stock Items** (قطع قريبة من النفاذ): Count (red badge)
6. **Customer Debts** (ديون الزبائن): Total amount + count
7. **Supplier Debts** (ديون التجار): Total amount + count (due soon highlighted)

**Widgets** (Tables):
1. **Low Stock Items**: Table with Item Name, Current Quantity, Min Quantity, Actions (Reorder button)
   - **Pagination**: 5 items per page
2. **Upcoming Periodic Maintenance** (for auto service vertical): Plate Number, Customer, Next Date
   - **Pagination**: 5 items per page
3. **Customer Debts**: Customer Name, Phone, Amount, Due Date, Actions (Collect Payment button)
   - **Pagination**: 5 items per page
4. **Supplier Debts Due Soon**: Supplier Name, Amount, Due Date, Actions (Pay button)
   - **Pagination**: 5 items per page

**Actions**:
- **Quick Sale Button** (floating action button, bottom-right): Opens POS
- **End of Day Button**: Opens Z-Report dialog

**Filters**: Date range for summary metrics (default: Current Day)

---

#### 7.2.2 Inventory Page (`/inventory`)

**Layout**: Data table with search, filters, pagination

**Columns**:
1. Item Name (اسم القطعة)
2. Category (الفئة)
3. Current Quantity (الكمية الحالية)
4. Min Quantity (الحد الأدنى)
5. Purchase Price (سعر الجملة)
6. Sale Price (سعر البيع)
7. Shelf Location (الموقع)
8. Status (الحالة): Badge (Green: In Stock, Yellow: Low, Red: Out of Stock)
9. Actions: View Details | Edit | Delete

**Filters**:
- **Search**: By item name
- **Category**: Dropdown (All | Fresh | Frozen | etc.)
- **Status**: Dropdown (All | In Stock | Low Stock | Out of Stock)

**Actions**:
- **New Item Button** (top-right): Opens `/inventory/new`
- **Export Button**: Exports to CSV/Excel

**Pagination**: 20 items per page

---

#### 7.2.3 New Inventory Item Page (`/inventory/new`)

**Form Fields**:
1. **Item Name (AR)**: Text input (required)
2. **Item Name (EN)**: Text input (optional)
3. **Category**: Dropdown (required)
4. **Barcode**: Text input (optional, unique validation)
5. **Primary UoM**: Dropdown (kg, pieces, liters, etc.) (required)
6. **Purchase Price**: Number input (required, ≥ 0)
7. **Sale Price**: Number input (required, ≥ 0)
8. **Min Quantity**: Number input (default 0)
9. **Is Weight-Based**: Checkbox
10. **Is Perishable**: Checkbox
11. **Default Expiry Days**: Number input (enabled if Is Perishable = true)
12. **Shelf Location**: Text input (optional)

**Validations**:
- Sale Price ≥ Purchase Price (warning, not blocking)
- Min Quantity ≥ 0
- Barcode unique (if provided)

**Actions**:
- **Save Button**: Creates item, redirects to `/inventory`
- **Cancel Button**: Redirects to `/inventory`

---

#### 7.2.4 Edit Inventory Item Page (`/inventory/:id/edit`)

**Same as New Item Form**, pre-filled with existing data.

**Additional Rules**:
- Cannot change `PrimaryUoM` if item has inventory lots (transactions exist)
- Barcode uniqueness validation (excluding current item)

---

#### 7.2.5 Inventory Item Details Page (`/inventory/:id`)

**Layout**: Tabs

**Tab 1: Overview**:
- Item details (name, category, barcode, UoM, prices, min quantity, status)
- **Current Stock Card**: Current Quantity, Shelf Location, Last Restock Date, Actions (Adjust Stock, Record Waste)

**Tab 2: Stock Movements**:
- Table: Date, Type (Purchase | Sale | Adjustment | Waste), Quantity (+ or -), Reference (link to transaction), User
- **Filters**: Date range, Type
- **Pagination**: 20 per page

**Tab 3: Inventory Lots** (FIFO Batches):
- Table: Purchase Date, Purchase #, Total Quantity, Remaining Quantity, Unit Cost, Expiry Date (if applicable)
- **Purpose**: Show which lots are still available for sale
- **Pagination**: 10 per page

**Tab 4: Purchase History**:
- Table: Date, Purchase #, Supplier, Quantity, Unit Price, Total
- **Actions**: View Purchase Details (link)
- **Pagination**: 20 per page

**Tab 5: Sales History**:
- Table: Date, Sale #, Customer, Quantity, Unit Price, Total
- **Actions**: View Sale Details (link)
- **Pagination**: 20 per page

**Actions** (Top Bar):
- **Edit Button**: Opens `/inventory/:id/edit`
- **Delete Button**: Prompts confirmation, deletes item (only if no transactions exist)
- **Back Button**: Returns to `/inventory`

---

#### 7.2.6 Sales Page (`/sales`)

**Layout**: Data table with search, filters, pagination

**Columns**:
1. Sale # (رقم الفاتورة)
2. Customer Name (اسم الزبون)
3. Customer Phone (رقم الهاتف)
4. Sale Date (التاريخ)
5. Gross Amount (المبلغ الإجمالي): Before discount
6. Discount (الخصم)
7. Net Amount (الصافي): After discount
8. Paid Amount (المدفوع)
9. Remaining (المتبقي): Color-coded (red if > 0)
10. Payment Status (الحالة): Badge (Red: Unpaid, Yellow: Partial, Green: Paid)
11. Actions: View Details | Edit (if no payments) | Delete (if no payments)

**Filters**:
- **Search**: By customer name or phone
- **Date Range**: From/To date pickers
- **Payment Status**: Dropdown (All | Unpaid | Partial | Paid)

**Actions**:
- **New Sale Button** (POS Button): Opens `/sales/new`
- **Export Button**: Exports to CSV/Excel

**Pagination**: 20 sales per page

---

#### 7.2.7 New Sale Page (POS) (`/sales/new`)

**Layout**: Two-column (60/40 split desktop, stacked mobile)

**Left Column: Cart**:
- **Items Table**:
  - Columns: Item Name, Quantity, UoM, Unit Price, Discount, Net Price, Total
  - **Actions per line**: Edit Quantity, Remove Line
- **Totals Section** (bottom):
  - Gross Total (before discount)
  - Sale-Level Discount (percentage or fixed, input field)
  - Net Total (after discount)
  - Tax Amount (if applicable)
  - **Grand Total**

**Right Column: Controls**:
1. **Add Item Section**:
   - **Search/Scan Input**: Barcode scanner or text search
   - **Quick Buttons**: Configurable grid of common items (e.g., Whole Chicken, Breast, Thigh)
   - **Selected Item Info**: Name, Price, Stock Available
   - **Quantity Input**: Number input (or weight from scale if weight-based)
   - **Add to Cart Button**

2. **Customer Selection**:
   - **Radio Buttons**: Walk-in Customer | Existing Customer
   - **If Walk-in**: Name input (required), Phone input (required)
   - **If Existing**: Phone search input → auto-fills name, shows credit balance

3. **Payment Section**:
   - **Payment Type**: Radio buttons (Full Payment | Partial Payment | Credit/Account)
   - **If Full/Partial**: Amount input (defaults to Grand Total for Full)
   - **Payment Method**: Dropdown (Cash | Card | Mobile)
   - **If Credit/Account**: Due Date picker
   - **Payment Date**: Date picker (defaults to today)

4. **Actions**:
   - **Save & Print Receipt Button** (primary, large): Saves sale, prints receipt, redirects to `/sales`
   - **Save Without Printing**: Saves sale, redirects to `/sales`
   - **Cancel Button**: Clears cart, stays on page (or redirects to `/sales`)

**Behaviors**:
- **Barcode Scan**: Auto-adds item to cart (default quantity = 1 or prompts for weight)
- **Quick Button Click**: Adds item to cart with default quantity
- **Weight-Based Items**: Prompts to read scale (via serial/USB integration) before adding to cart
- **Discount Approval**: If sale-level discount > threshold, prompts for manager PIN (modal dialog)
- **Insufficient Stock**: Shows warning (red badge) but allows sale if negative inventory is permitted by role
- **Credit Limit Exceeded**: Shows warning and requires manager approval if customer's current balance + sale total > credit limit

**Validations**:
- Cart not empty
- Customer name & phone provided
- Payment amount ≤ Grand Total (for partial payment)
- If credit sale, due date must be in future

---

#### 7.2.8 Sale Details Page (`/sales/:id`)

**Layout**: Tabs

**Tab 1: Overview**:
- **Sale Header**: Sale #, Customer Name & Phone (link to customer), Sale Date, Cashier, Status Badge
- **Items Table**: Item Name, Quantity, UoM, Unit Price, Discount, Net Price, Total
- **Totals Section**: Gross, Discount, Net, Tax, Grand Total
- **Cost & Profit** (visible to Manager/Admin only):
  - Total Cost (COGS), Total Profit, Profit Margin %

**Tab 2: Payments**:
- **Table**: Payment Date, Method, Amount, User
- **Summary**: Total Paid, Remaining Balance
- **Actions**: 
  - **Add Payment Button** (if remaining > 0): Opens payment dialog
  - **Print Receipt Button**: Reprints receipt

**Tab 3: Cost Breakdown** (visible to Manager/Admin only):
- **Table per Sale Line**: Item, Quantity, Sale Price, Cost Allocations (from which lots)
- **Sub-table**: Lot Purchase Date, Lot Unit Cost, Allocated Quantity, Line Cost
- **Purpose**: Audit FIFO allocation

**Actions** (Top Bar):
- **Edit Button**: Opens `/sales/:id/edit` (only if no payments)
- **Delete Button**: Prompts confirmation, deletes sale (only if no payments)
- **Void Button** (future): Creates return transaction
- **Back Button**: Returns to `/sales`

---

#### 7.2.9 Purchasing Page (`/purchasing`)

**Layout**: Data table with search, filters, pagination

**Columns**:
1. Purchase # (رقم الفاتورة)
2. Supplier Name (اسم التاجر)
3. Purchase Date (التاريخ)
4. Total Amount (المبلغ الإجمالي)
5. Paid Amount (المدفوع)
6. Remaining (المتبقي): Color-coded (red if > 0)
7. Due Date (تاريخ السداد)
8. Payment Status (الحالة): Badge (Red: Unpaid, Yellow: Partial, Green: Paid)
9. Actions: View Details | Edit (if no payments) | Delete (if no payments)

**Filters**:
- **Search**: By supplier name
- **Date Range**: From/To date pickers
- **Payment Status**: Dropdown (All | Unpaid | Partial | Paid)

**Actions**:
- **New Purchase Button**: Opens `/purchasing/new`
- **Export Button**: Exports to CSV/Excel

**Pagination**: 20 purchases per page

---

#### 7.2.10 New Purchase Page (`/purchasing/new`)

**Layout**: Form with line items table

**Form Fields**:
1. **Supplier**: Dropdown (existing) or "Add New" button (opens inline form: Name, Phone)
2. **Purchase Date**: Date picker (defaults to today)
3. **Items Table**:
   - **Columns**: Item (dropdown/search), Quantity, UoM, Unit Purchase Price, Suggested Sale Price (optional), Expiry Date (if perishable), Line Total
   - **Actions per line**: Remove Line
   - **Add Line Button** (below table): Adds new row
4. **Totals Section**:
   - Gross Total
   - Tax Amount (if applicable)
   - **Grand Total**
5. **Payment Section**:
   - **Paid Amount**: Number input (defaults to 0)
   - **Payment Method**: Dropdown (Cash | BankTransfer | Check)
   - **Due Date** (for remaining balance): Date picker

**Actions**:
- **Save Button**: Creates purchase, redirects to `/purchasing`
- **Cancel Button**: Redirects to `/purchasing`

**Validations**:
- Supplier selected
- At least one item line
- Quantities > 0
- Prices ≥ 0
- Paid amount ≤ Grand Total

**Behaviors**:
- On save, system creates `InventoryLot` for each line, updates `Inventory`, creates `Debt` if remaining > 0

---

#### 7.2.11 Purchase Details Page (`/purchasing/:id`)

**Layout**: Tabs (similar to Sale Details)

**Tab 1: Overview**:
- Purchase Header, Supplier (link), Items Table, Totals

**Tab 2: Payments**:
- Payments table, Add Payment button, Summary

**Tab 3: Inventory Lots Created**:
- Table: Item, Lot #, Total Quantity, Remaining Quantity, Unit Cost, Expiry Date

**Actions**: Edit (if no payments), Delete (if no payments), Back

---

#### 7.2.12 Customers Page (`/customers`)

**Layout**: Data table with search, pagination

**Columns**:
1. Customer Name (الاسم)
2. Phone (الهاتف)
3. Address (العنوان)
4. Credit Limit (الحد الائتماني)
5. Current Balance (الرصيد الحالي): Color-coded (red if > 0)
6. Total Sales Count (عدد المبيعات)
7. Actions: View Details | Edit | Delete

**Filters**:
- **Search**: By name or phone
- **Balance Filter**: Dropdown (All | With Balance | No Balance)

**Actions**:
- **New Customer Button**: Opens inline form (Name, Phone, Address, Credit Limit)
- **Export Button**: Exports to CSV/Excel

**Pagination**: 20 customers per page

---

#### 7.2.13 Customer Details Page (`/customers/:id`)

**Layout**: Tabs

**Tab 1: Overview**:
- Customer info (name, phone, address, credit limit, current balance)
- **Summary Cards**: Total Sales Count, Total Sales Amount, Total Paid, Total Outstanding

**Tab 2: Sales History**:
- Table: Sale Date, Sale #, Amount, Paid, Remaining, Status
- **Actions**: View Sale Details (link), Collect Payment (if remaining > 0)
- **Pagination**: 20 per page

**Tab 3: Outstanding Debts**:
- Table: Sale #, Sale Date, Amount Due, Due Date, Days Overdue (if past due date)
- **Actions**: Collect Payment button
- **Pagination**: 10 per page

**Tab 4: Payment History**:
- Table: Payment Date, Sale #, Amount Paid, Method
- **Pagination**: 20 per page

**Actions**: Edit Customer, Delete Customer (only if no sales), Back

---

#### 7.2.14 Suppliers Page (`/traders`)

**Layout**: Data table (similar to Customers)

**Columns**:
1. Supplier Name (الاسم)
2. Phone (الهاتف)
3. Payment Terms (شروط الدفع)
4. Current Balance (المستحقات): Color-coded (red if > 0)
5. Total Purchases Count (عدد المشتريات)
6. Actions: View Details | Edit | Delete

**Filters**: Search by name

**Actions**: New Supplier Button, Export Button

**Pagination**: 20 per page

---

#### 7.2.15 Supplier Details Page (`/traders/:id`)

**Layout**: Tabs (similar to Customer Details)

**Tab 1: Overview**:
- Supplier info, Summary Cards

**Tab 2: Purchase History**:
- Table: Purchase Date, Purchase #, Amount, Paid, Remaining, Status
- **Actions**: View Purchase Details, Make Payment

**Tab 3: Outstanding Payables**:
- Table: Purchase #, Purchase Date, Amount Due, Due Date, Days Until Due
- **Actions**: Make Payment button

**Tab 4: Payment History**:
- Table: Payment Date, Purchase #, Amount Paid, Method

**Actions**: Edit Supplier, Delete Supplier (only if no purchases), Back

---

#### 7.2.16 Personal Expenses Page (`/personal-expenses`)

**Layout**: Data table with filters

**Columns**:
1. Expense Date (التاريخ)
2. Payee Name (المدفوع لـ)
3. Category (الفئة)
4. Amount (المبلغ)
5. Payment Method (طريقة الدفع)
6. Notes (ملاحظات)
7. Actions: Edit | Delete

**Filters**:
- **Date Range**: From/To date pickers
- **Category**: Dropdown (All | Rent | Utilities | Salaries | Supplies | Other)

**Actions**:
- **New Expense Button**: Opens `/personal-expenses/new`
- **Export Button**: Exports to CSV/Excel

**Pagination**: 20 per page

---

#### 7.2.17 New Personal Expense Page (`/personal-expenses/new`)

**Form Fields**:
1. **Payee Name**: Text input (required)
2. **Amount**: Number input (required, > 0)
3. **Category**: Dropdown (Rent | Utilities | Salaries | Supplies | Other)
4. **Payment Method**: Dropdown (Cash | BankTransfer | Check | Card)
5. **Expense Date**: Date picker (defaults to today)
6. **Notes**: Text area (optional)

**Actions**:
- **Save Button**: Creates expense, redirects to `/personal-expenses`
- **Cancel Button**: Redirects to `/personal-expenses`

---

#### 7.2.18 Settings Page (`/settings`)

**Layout**: Tabs

**Tab 1: Shop Settings**:
- Shop Name (AR), Shop Name (EN)
- Logo Upload
- Contact Info (Phone, Address, Email)
- Fiscal Year Start
- Base Currency
- Default Tax Rate
- Receipt Header Text

**Tab 2: Users**:
- User list table: Username, Full Name, Role, Status
- **Actions**: Add User, Edit User, Deactivate User

**Tab 3: Categories**:
- Category list table: Name (AR), Name (EN), Parent Category, Tax Rate, Sort Order
- **Actions**: Add Category, Edit Category, Delete Category

**Tab 4: Printers & Devices**:
- Thermal Printer configuration (COM port, baud rate, test print button)
- Scale configuration (COM port, baud rate, test read button)
- Barcode scanner configuration

**Actions**: Save Settings (per tab)

---

### 7.3 Routing Conventions

| Route | Page | Access |
|-------|------|--------|
| `/login` | Login | Public |
| `/` | Dashboard | All authenticated |
| `/inventory` | Inventory List | All authenticated |
| `/inventory/new` | New Item | Admin, Manager, Purchaser |
| `/inventory/:id` | Item Details | All authenticated |
| `/inventory/:id/edit` | Edit Item | Admin, Manager, Purchaser |
| `/sales` | Sales List | Admin, Manager, Cashier |
| `/sales/new` | POS (New Sale) | Admin, Manager, Cashier |
| `/sales/:id` | Sale Details | Admin, Manager, Cashier |
| `/sales/:id/edit` | Edit Sale | Admin, Manager |
| `/purchasing` | Purchase List | Admin, Manager, Purchaser |
| `/purchasing/new` | New Purchase | Admin, Manager, Purchaser |
| `/purchasing/:id` | Purchase Details | Admin, Manager, Purchaser |
| `/purchasing/:id/edit` | Edit Purchase | Admin, Manager, Purchaser |
| `/customers` | Customer List | All authenticated |
| `/customers/:id` | Customer Details | All authenticated |
| `/traders` | Supplier List | Admin, Manager, Purchaser |
| `/traders/new` | New Supplier | Admin, Manager, Purchaser |
| `/traders/:id` | Supplier Details | Admin, Manager, Purchaser |
| `/traders/:id/edit` | Edit Supplier | Admin, Manager, Purchaser |
| `/personal-expenses` | Expense List | Admin, Manager |
| `/personal-expenses/new` | New Expense | Admin, Manager |
| `/personal-expenses/:id/edit` | Edit Expense | Admin, Manager |
| `/reports/sales` | Sales Reports | Admin, Manager, Accountant |
| `/reports/inventory` | Inventory Reports | Admin, Manager, Accountant |
| `/reports/financial` | Financial Reports | Admin, Manager, Accountant |
| `/reports/tax` | Tax Reports | Admin, Accountant |
| `/settings` | Settings | Admin |

**Route Guards**: All authenticated routes require valid JWT token. Role-specific routes enforce permission checks on backend.

---

### 7.4 UI Components & Design System

#### 7.4.1 Component Library
- **Base**: React 18+ with TypeScript
- **UI Framework**: shadcn/ui (built on Radix UI primitives)
- **Icons**: Lucide React
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **State Management**: TanStack Query (React Query) for server state, Zustand for local state
- **Tables**: TanStack Table (React Table)
- **Date Pickers**: react-day-picker
- **Dialogs/Modals**: Radix Dialog (via shadcn/ui)

#### 7.4.2 Design Tokens
- **Colors**:
  - Primary: Blue (#3B82F6)
  - Success: Green (#10B981)
  - Warning: Yellow (#F59E0B)
  - Danger: Red (#EF4444)
  - Sidebar: Dark (#1E293B)
- **Typography**:
  - Font: Tajawal (Arabic), Inter (English)
  - Sizes: 12px (small), 14px (body), 16px (large), 20px (heading), 24px (title)
- **Spacing**: 4px base unit (4, 8, 12, 16, 20, 24, 32, 40, 48)
- **Border Radius**: 6px (cards), 8px (buttons)

#### 7.4.3 Responsive Breakpoints
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md/lg)
- Desktop: > 1024px (xl)

**Mobile Adaptations**:
- Sidebar collapses to hamburger menu
- POS: Stacks cart above controls
- Tables: Horizontal scroll + sticky first column
- Dashboard: 1 column layout

---

## 8. Reporting

### 8.1 Financial Statements

#### 8.1.1 Profit & Loss Statement (Income Statement)

**Sections**:
1. **Revenue**:
   - Sales Revenue: Sum of `Sale.TotalAmount` (net after discount)
   - Service Revenue: (vertical-specific, e.g., maintenance fees)
   - **Total Revenue**

2. **Cost of Goods Sold**:
   - COGS: Sum of `Sale.TotalCost` (FIFO calculated)
   - Shrinkage/Waste: Sum of waste adjustments (optional separate line)
   - **Total COGS**

3. **Gross Profit**: Revenue - COGS

4. **Operating Expenses**:
   - Salaries: Sum of `PersonalExpense` where category = Salaries
   - Rent: Sum of `PersonalExpense` where category = Rent
   - Utilities: Sum of `PersonalExpense` where category = Utilities
   - Supplies: Sum of `PersonalExpense` where category = Supplies
   - Other: Sum of other `PersonalExpense` categories
   - **Total Operating Expenses**

5. **Net Profit**: Gross Profit - Operating Expenses

**Filters**: Date Range (Day, Week, Month, Quarter, Year, Custom)

**Export**: PDF, Excel

**Example** (Chicken Shop):
```
Profit & Loss Statement
Period: January 1 - January 31, 2026

Revenue:
  Sales Revenue:              50,000 ILS
  -------------------------
  Total Revenue:              50,000 ILS

Cost of Goods Sold:
  COGS (FIFO):                35,000 ILS
  Shrinkage/Waste:             1,000 ILS
  -------------------------
  Total COGS:                 36,000 ILS

Gross Profit:                 14,000 ILS
Gross Margin:                 28%

Operating Expenses:
  Salaries:                    3,000 ILS
  Rent:                        2,000 ILS
  Utilities (Electric, Water):   500 ILS
  Supplies (Bags, Knives):       300 ILS
  Other:                         200 ILS
  -------------------------
  Total Operating Expenses:    6,000 ILS

Net Profit:                    8,000 ILS
Net Margin:                    16%
```

---

#### 8.1.2 Cash Flow Statement (Simplified)

**Sections**:
1. **Cash Inflows**:
   - Cash sales: Sum of `Payment` where ReferenceType = Sale, Method = Cash
   - Card sales: Sum of `Payment` where ReferenceType = Sale, Method = Card
   - Receivables collected: Same but for credit sales
   - **Total Inflows**

2. **Cash Outflows**:
   - Cash purchases: Sum of `Payment` where ReferenceType = Purchase, Method = Cash
   - Payables paid: Same but for credit purchases
   - Personal expenses: Sum of `PersonalExpense.Amount`
   - **Total Outflows**

3. **Net Cash Flow**: Inflows - Outflows

**Filters**: Date Range

**Export**: PDF, Excel

---

#### 8.1.3 Balance Sheet (Simplified, Future)

**Note**: Not fully implemented. Requires chart of accounts and journal entries.

**Sections**:
1. **Assets**:
   - Cash: Sum of cash payments - cash outflows
   - Accounts Receivable: Sum of `Debt` where Direction = Owed_To_Me
   - Inventory: Sum of `InventoryLot.RemainingQuantity × UnitPurchasePrice`
   - **Total Assets**

2. **Liabilities**:
   - Accounts Payable: Sum of `Debt` where Direction = I_Owe
   - **Total Liabilities**

3. **Equity**:
   - Owner's Equity: (manual entry or opening balance)
   - Retained Earnings: Cumulative net profit
   - **Total Equity**

**Equation**: Assets = Liabilities + Equity

---

### 8.2 Operational Reports

#### 8.2.1 Sales Summary Report

**Purpose**: Analyze sales performance over time.

**Metrics**:
- Total Sales Count
- Total Sales Amount (gross, discount, net)
- Total Profit
- Average Sale Value
- Average Profit per Sale

**Grouping**: By Day, Week, Month

**Chart**: Line chart (sales amount over time)

**Table**: Date, Sales Count, Gross, Discount, Net, COGS, Profit, Margin %

**Filters**: Date Range, Cashier, Payment Status

**Export**: PDF, Excel

---

#### 8.2.2 Top Selling Items Report

**Purpose**: Identify best-selling products.

**Metrics per Item**:
- Total Quantity Sold
- Total Sales Amount
- Total Profit
- Average Sale Price

**Sorting**: By quantity (descending) or by profit (descending)

**Chart**: Bar chart (top 10 items by quantity)

**Filters**: Date Range, Category

**Export**: PDF, Excel

---

#### 8.2.3 Inventory Valuation Report

**Purpose**: Current inventory value at cost.

**Table**: Item Name, Category, Current Quantity, Avg Unit Cost (from lots), Total Value

**Totals**: Total Inventory Value (sum of all items)

**Filters**: Category

**Export**: PDF, Excel

---

#### 8.2.4 Stock Movement Report

**Purpose**: Audit trail of all inventory changes.

**Table**: Date, Item, Type, Quantity (+ or -), Reference, User, Notes

**Filters**: Date Range, Item, Type (Purchase/Sale/Adjustment/Waste)

**Export**: Excel (large dataset)

---

#### 8.2.5 Customer Sales Report

**Purpose**: Sales performance per customer.

**Metrics per Customer**:
- Total Sales Count
- Total Sales Amount
- Total Paid
- Total Outstanding
- Average Sale Value

**Sorting**: By sales amount (descending) or by outstanding (descending)

**Filters**: Date Range, Balance Filter (All | With Balance | No Balance)

**Export**: PDF, Excel

---

#### 8.2.6 Supplier Purchase Report

**Purpose**: Purchase activity per supplier.

**Metrics per Supplier**:
- Total Purchase Count
- Total Purchase Amount
- Total Paid
- Total Outstanding
- Average Purchase Value

**Filters**: Date Range

**Export**: PDF, Excel

---

#### 8.2.7 Waste & Shrinkage Report

**Purpose**: Track inventory losses.

**Table**: Date, Item, Quantity, Reason, Cost (from FIFO lots), User

**Totals**: Total Waste Quantity, Total Cost

**Chart**: Pie chart (waste by reason)

**Filters**: Date Range, Reason

**Export**: PDF, Excel

---

### 8.3 Tax Reports

#### 8.3.1 VAT Summary Report

**Purpose**: Calculate VAT liability for government filing.

**Sections**:
1. **Output VAT (Sales Tax Collected)**:
   - Sum of `Sale.TaxAmount`
2. **Input VAT (Purchase Tax Paid)**:
   - Sum of `Purchase.TaxAmount`
3. **Net VAT Due**: Output VAT - Input VAT (pay to government if positive)

**Filters**: Month, Quarter

**Export**: PDF, Excel

**Note**: This is a simplified calculation. For compliance, consult local tax regulations.

---

### 8.4 Export Formats

#### 8.4.1 PDF
- **Layout**: A4 portrait or landscape (depending on report)
- **Header**: Shop logo, name, report title, date range
- **Footer**: Page number, generation date/time
- **Tables**: Formatted with borders, alternating row colors
- **Charts**: Embedded as images (via chart library)

#### 8.4.2 Excel (XLSX)
- **Sheets**: One per report section (e.g., Summary, Details)
- **Formatting**: Bold headers, number formatting (currency, percentages)
- **Formulas**: Totals, subtotals, averages

#### 8.4.3 CSV
- **Encoding**: UTF-8 with BOM (for Arabic support)
- **Delimiter**: Comma
- **Purpose**: For import into external systems (accounting software, Excel)

---

## 9. Integrations & Imports/Exports

### 9.1 Hardware Integrations

#### 9.1.1 Thermal Printer
- **Purpose**: Print receipts (Arabic/English)
- **Protocol**: ESC/POS (industry standard for thermal printers)
- **Connection**: USB, Serial (COM port), or Network (IP)
- **Configuration**: COM port, baud rate (9600, 19200, 38400), IP address
- **Test Print**: Button in settings to verify connectivity

**Receipt Format**:
```
========================================
      [Shop Name in Arabic]
      [Shop Name in English]
========================================
التاريخ (Date): 2026-02-04 14:30
فاتورة (Invoice): INV-2026-0042
زبون (Customer): أحمد محمود / Ahmed Mahmoud
هاتف (Phone): 0599123456
========================================
صنف (Item)         الكمية   السعر   الإجمالي
                   Qty      Price   Total
----------------------------------------
دجاج كامل           2 kg    20.00   40.00
صدور دجاج           1 kg    30.00   30.00
----------------------------------------
الإجمالي (Subtotal):             70.00
الخصم (Discount):                  5.00
الضريبة (VAT 17%):                11.05
----------------------------------------
المجموع (Total):                  76.05
المدفوع (Paid):                   76.05
الباقي (Change):                   0.00
========================================
       شكراً لزيارتكم
       Thank you!
========================================
```

#### 9.1.2 Digital Scale
- **Purpose**: Weigh items for weight-based pricing
- **Protocol**: Serial (RS-232) or USB (HID)
- **Connection**: COM port or USB
- **Configuration**: COM port, baud rate, weight unit (kg/g/lb)
- **Test Read**: Button in settings to display current weight

**Integration Flow**:
1. User selects weight-based item in POS
2. System prompts: "Place item on scale"
3. User clicks "Read Weight" button (or auto-reads every 1s)
4. System reads weight from scale (e.g., 2.35 kg)
5. Calculates price: 2.35 kg × 20 ILS/kg = 47.00 ILS
6. Adds to cart

#### 9.1.3 Barcode Scanner
- **Purpose**: Fast item lookup by scanning barcode
- **Protocol**: USB HID (keyboard emulation) or Serial
- **Configuration**: No special config needed (acts as keyboard input)
- **Test Scan**: Scan test barcode in settings to verify

**Integration Flow**:
1. User focuses on search input in POS
2. Scans barcode → scanner sends barcode as keyboard input
3. System searches `Item` by `Barcode` field
4. If found, auto-adds to cart; if not found, shows "Item not found" error

#### 9.1.4 Cash Drawer
- **Purpose**: Secure cash storage, opens automatically on sale
- **Protocol**: Pulse signal via printer (most thermal printers support cash drawer kick)
- **Connection**: RJ-11/12 cable from printer to drawer
- **Configuration**: Enable "Open drawer on sale" checkbox in settings

---

### 9.2 Payment Gateway Integration (Future)

**Note**: Not currently implemented. Recommended for Phase 2.

#### 9.2.1 Credit Card Processing
- **Providers**: Stripe, PayPal, local processors (e.g., Payfort, PayTabs for MENA region)
- **Flow**:
  1. In POS payment section, select "Card" method
  2. If terminal integrated: swipe/insert card → system sends amount to terminal → terminal returns approval
  3. If gateway integrated: redirect to payment page → customer enters card details → return to POS with payment token
  4. System records payment with gateway transaction ID

#### 9.2.2 Mobile Payment (QR Code)
- **Providers**: Local mobile wallets (e.g., Jawwal Pay, Ooredoo Money)
- **Flow**:
  1. Generate QR code for payment amount
  2. Customer scans with mobile wallet app
  3. Webhook notifies system of payment
  4. System records payment

---

### 9.3 External Accounting Export (Future)

**Purpose**: Export transactions to external accounting software (e.g., QuickBooks, Xero, local ERPs).

#### 9.3.1 Chart of Accounts Mapping
- Admin maps system accounts to external software accounts (one-time setup)
- Example:
  - System "Sales Revenue" → QuickBooks "Income:Sales"
  - System "COGS" → QuickBooks "Expense:Cost of Goods Sold"

#### 9.3.2 Journal Entry Export
- **Format**: CSV or XML (depending on target software)
- **Structure**: Date, Account, Debit, Credit, Reference, Memo
- **Frequency**: Daily, weekly, or manual export

**Example CSV Export**:
```csv
Date,Account,Debit,Credit,Reference,Memo
2026-02-04,1100 Cash,76.05,0,INV-2026-0042,Sale to Ahmed Mahmoud
2026-02-04,4100 Sales Revenue,0,65.00,INV-2026-0042,Sale to Ahmed Mahmoud
2026-02-04,2200 VAT Payable,0,11.05,INV-2026-0042,VAT on sale
2026-02-04,5100 COGS,45.00,0,INV-2026-0042,COGS for sale
2026-02-04,1400 Inventory,0,45.00,INV-2026-0042,Inventory reduction
```

---

### 9.4 Bulk Import Templates

**Purpose**: Bulk import of master data (items, customers, suppliers) from Excel.

#### 9.4.1 Item Import Template
**Columns**: Name (AR), Name (EN), Category, Barcode, UoM, Purchase Price, Sale Price, Min Quantity, Shelf Location, Is Weight-Based, Is Perishable

**Validations**: 
- Required: Name (AR), Category, Purchase Price, Sale Price
- Unique: Barcode (if provided)
- Category must exist (or use "Create if not exists" flag)

**Process**: Upload XLSX → system validates → shows preview with errors → user confirms → imports

#### 9.4.2 Customer Import Template
**Columns**: Name, Phone, Email, Address, Credit Limit

**Validations**:
- Required: Name, Phone
- Unique: Phone

#### 9.4.3 Opening Stock Import
**Columns**: Item (by Name or Barcode), Quantity, Unit Cost

**Process**: Creates `InventoryLot` for each line with `ReceivedAt = import date`, no purchase reference

---

## 10. Non-Functional Requirements

### 10.1 Security

#### 10.1.1 Authentication
- **Method**: JWT (JSON Web Token) with refresh tokens
- **Flow**:
  1. User submits username/password
  2. Backend validates credentials, returns JWT (expires in 15 minutes) + refresh token (expires in 7 days)
  3. Frontend stores tokens in HttpOnly cookies (not localStorage for XSS protection)
  4. On JWT expiry, frontend uses refresh token to get new JWT
- **Password Storage**: Hashed with bcrypt (cost factor ≥ 12)

#### 10.1.2 Authorization
- **Method**: Role-Based Access Control (RBAC)
- **Implementation**: Backend checks user role on every API request; frontend hides UI elements based on role (but does not rely on frontend for security)
- **Permission Checks**: Per operation (create, read, update, delete) on each resource

#### 10.1.3 Data Encryption
- **In Transit**: HTTPS/TLS 1.2+ for all API communication
- **At Rest**: Database encryption (optional, recommended for cloud deployments)

#### 10.1.4 Audit Logs
- **Logged Events**: User login/logout, create/edit/delete transactions, payment additions, inventory adjustments
- **Stored**: In database with timestamp, user ID, action type, entity ID
- **Retention**: Configurable (default 1 year), cannot be deleted by users

---

### 10.2 Performance

#### 10.2.1 Response Times
- **POS Sale Creation**: < 3 seconds (including FIFO calculation)
- **Page Load**: < 2 seconds (initial load), < 1 second (subsequent navigation)
- **Report Generation**: < 5 seconds for standard reports, < 30 seconds for large exports (e.g., full year stock movements)

#### 10.2.2 Scalability
- **Concurrent Users**: Supports 10 concurrent users (single-tenant deployment)
- **Database Size**: Optimized for 100K transactions/year, 10K items, 50K customers
- **Indexing**: All foreign keys, frequently queried columns (e.g., SaleDate, PaymentStatus), and search fields (e.g., ItemName, Barcode)

#### 10.2.3 Optimization Strategies
- **Pagination**: All list endpoints return paginated results (default 20 items/page)
- **Lazy Loading**: Load related entities on-demand (e.g., sale lines only when viewing sale details)
- **Caching**: Cache static data (categories, settings) in frontend for 5 minutes
- **Database Queries**: Use indexes, avoid N+1 queries (use eager loading), minimize joins

---

### 10.3 Reliability

#### 10.3.1 Uptime
- **Target**: 99.5% uptime (cloud deployments), N/A for local deployments (depends on hardware)

#### 10.3.2 Backup & Recovery
- **Backup Frequency**: 
  - Cloud: Automatic daily backups (retained for 30 days)
  - Local: Manual export (CSV/Excel) or database backup (admin responsibility)
- **Recovery Time Objective (RTO)**: < 4 hours for cloud, < 1 hour for local (restore from backup)
- **Recovery Point Objective (RPO)**: < 24 hours (data loss limited to transactions since last backup)

#### 10.3.3 Error Handling
- **User-Facing Errors**: Clear, localized messages (Arabic/English) with suggested actions
  - Example: "الكمية غير كافية. القطعة الحالية: 5. مطلوب: 10." (Insufficient stock. Current: 5. Required: 10.)
- **System Errors**: Log to backend with stack trace, show generic "حدث خطأ. يرجى المحاولة مرة أخرى." (An error occurred. Please try again.) to user
- **Network Errors**: Retry failed requests (3 attempts with exponential backoff), show offline indicator if server unreachable

---

### 10.4 Usability

#### 10.4.1 Localization (i18n)
- **Primary Language**: Arabic (RTL)
- **Secondary Language**: English (LTR)
- **Switching**: Settings → Language dropdown (applies globally)
- **Translations**: All UI labels, error messages, reports, receipts
- **Number Formatting**: Arabic numerals (٠١٢٣٤٥٦٧٨٩) vs Western numerals (0123456789) - configurable per user preference

#### 10.4.2 Accessibility (a11y)
- **Keyboard Navigation**: All actions accessible via keyboard (Tab, Enter, Esc)
- **Screen Reader Support**: ARIA labels on interactive elements
- **Color Contrast**: WCAG AA compliance (minimum 4.5:1 for text)
- **Font Size**: Adjustable in browser settings

#### 10.4.3 Touchscreen Optimization
- **Button Size**: Minimum 44×44 px for touch targets (especially in POS)
- **Spacing**: 8px minimum between adjacent touch targets
- **Gestures**: Swipe to delete (on mobile), pull to refresh

---

### 10.5 Multi-Tenant Isolation

#### 10.5.1 Data Isolation
- **Method**: Logical isolation via `TenantId` column on all entities
- **Enforcement**: Database-level row-level security (RLS) or application-level filtering (every query includes `WHERE TenantId = @CurrentTenantId`)
- **No Cross-Tenant Access**: Users cannot view or modify data from other tenants

#### 10.5.2 Resource Isolation
- **Database**: Shared database with logical isolation (recommended for cost efficiency)
- **Files (Logos, Receipts)**: Stored in tenant-specific folders (`/uploads/{tenantId}/`)
- **Background Jobs**: Queue per tenant (e.g., report generation, backup)

#### 10.5.3 Tenant Provisioning (Future SaaS Feature)
- **Signup Flow**: User signs up → system creates tenant, assigns admin user, seeds default data (categories, chart of accounts template, sample items)
- **Onboarding**: Wizard to configure shop settings, upload logo, create categories, import opening stock

---

## 11. Acceptance Criteria

### 11.1 Inventory Module
- ✅ Admin can create, edit, delete items with all required fields (name, category, prices, UoM)
- ✅ System displays inventory list with search, filters (category, status), pagination
- ✅ Low stock items are highlighted (yellow/red badge) based on MinQuantity
- ✅ Item details page shows current stock, stock movements, purchase/sales history
- ✅ Barcode field enforces uniqueness
- ✅ System prevents deletion of items with existing transactions

### 11.2 Sales Module
- ✅ Cashier can create sale via POS with item search/scan, quantity input, discounts
- ✅ Weight-based items integrate with scale (reads weight, calculates price)
- ✅ System calculates FIFO cost allocation for each sale line
- ✅ Sale saves with correct TotalCost, TotalProfit, PaymentStatus
- ✅ System creates `InventoryLot` consumption records (`SaleLineCostAllocation`)
- ✅ System updates `Inventory.CurrentQuantity` (decreases)
- ✅ System creates `Debt` record for credit sales (Direction: Owed_To_Me)
- ✅ System blocks sale if insufficient inventory (unless negative inventory allowed)
- ✅ Discount > threshold prompts for manager approval
- ✅ Receipt prints on thermal printer (Arabic/English, correct format)
- ✅ Sale cannot be edited/deleted if payments exist
- ✅ Sale details page shows cost breakdown (lots consumed) for admin/manager

### 11.3 Purchasing Module
- ✅ Purchaser can create purchase with supplier, items, quantities, prices
- ✅ System creates `InventoryLot` for each purchase line (TotalQuantity, RemainingQuantity, UnitPurchasePrice)
- ✅ System updates `Inventory.CurrentQuantity` (increases)
- ✅ System creates `Debt` record for credit purchases (Direction: I_Owe)
- ✅ Purchase cannot be edited/deleted if payments exist
- ✅ Expiry date tracked for perishable items

### 11.4 Payment Module
- ✅ User can add payments to sales/purchases (amount ≤ remaining balance)
- ✅ System updates `PaymentStatus` (Unpaid → PartiallyPaid → Paid) correctly
- ✅ System updates or deletes `Debt` record based on remaining balance
- ✅ Payment history displays on sale/purchase details pages

### 11.5 Customer/Supplier Module
- ✅ System auto-creates customer from sale if phone number doesn't exist
- ✅ Customer details page shows sales history, outstanding debts, payment history
- ✅ Supplier details page shows purchase history, outstanding payables, payment history
- ✅ CurrentBalance computed correctly (sum of debts)

### 11.6 Dashboard Module
- ✅ Dashboard displays summary metrics (customers, inventory items, sales profit, debts)
- ✅ Low stock items widget shows items with Quantity ≤ MinQuantity
- ✅ Customer debts widget shows all receivables (Owed_To_Me)
- ✅ Supplier debts widget shows payables (I_Owe) due soon

### 11.7 Accounting Module
- ✅ FIFO cost calculation works correctly (consumes oldest lots first)
- ✅ `SaleLineCostAllocation` records created for each sale line
- ✅ `TotalProfit` = `TotalAmount` - `TotalCost` (accurate for all sales)
- ✅ `SalesProfit.TotalProfit` aggregates correctly (increases on sale, decreases on delete/edit)
- ✅ Waste adjustment reduces inventory, consumes lots via FIFO, does not affect profit directly

### 11.8 Reporting Module
- ✅ Profit & Loss statement shows revenue, COGS, gross profit, expenses, net profit
- ✅ Sales summary report groups sales by date, shows totals and profit
- ✅ Top selling items report sorts by quantity or profit
- ✅ Inventory valuation report calculates total inventory value (sum of lots × unit cost)
- ✅ Customer sales report shows per-customer metrics
- ✅ Supplier purchase report shows per-supplier metrics
- ✅ All reports export to PDF and Excel
- ✅ VAT summary report calculates output VAT - input VAT correctly

### 11.9 Security & Permissions
- ✅ JWT authentication works (login, token refresh, logout)
- ✅ Role-based access control enforced (cashier cannot access purchases, etc.)
- ✅ Manager approval required for discounts > threshold
- ✅ Audit logs created for critical operations (sales, purchases, adjustments)
- ✅ Passwords hashed with bcrypt

### 11.10 Usability
- ✅ Arabic RTL interface works correctly (text, layout, forms)
- ✅ English translation available (switchable in settings)
- ✅ POS page is touch-friendly (large buttons, clear layout)
- ✅ Error messages are clear and actionable
- ✅ All tables have search, filters, pagination
- ✅ All forms have validation (frontend + backend)

### 11.11 Hardware Integration
- ✅ Thermal printer prints receipts (Arabic/English format)
- ✅ Digital scale integration reads weight accurately
- ✅ Barcode scanner auto-adds items to cart
- ✅ Settings page allows configuration of printer, scale, scanner (COM ports, baud rates)

### 11.12 Configuration & Multi-Vertical Support
- ✅ Settings page allows customization of shop name, logo, tax rate
- ✅ Categories are customizable per tenant (not hardcoded)
- ✅ Chart of accounts template provided (can be customized)
- ✅ System supports multiple UoMs (kg, pieces, liters, etc.)
- ✅ System supports weight-based pricing (scale integration)
- ✅ System supports perishable items (expiry date tracking)

---

## 12. Vertical-Specific Configuration Examples

### 12.1 Chicken Shop Configuration

#### 12.1.1 Categories
- Fresh Chicken (فروج طازج)
  - Whole Chicken (فروج كامل)
  - Chicken Breast (صدور دجاج)
  - Chicken Thighs (أفخاذ دجاج)
  - Chicken Wings (أجنحة دجاج)
- Cut-Up Chicken (تقطيع)
  - Bone-In Pieces (قطع بالعظم)
  - Boneless (بدون عظم)
- Frozen Chicken (فروج مجمد)
- Cooked Chicken (دجاج مطبوخ)
  - Grilled (مشوي)
  - Fried (مقلي)
- Extras (إضافات)
  - Spices (بهارات)
  - Packaging (أكياس، علب)

#### 12.1.2 Items (Examples)
| Name (AR) | Name (EN) | Category | UoM | Is Weight-Based | Is Perishable | Default Expiry Days |
|-----------|-----------|----------|-----|-----------------|---------------|---------------------|
| فروج كامل | Whole Chicken | Fresh | kg | Yes | Yes | 2 |
| صدور دجاج | Chicken Breast | Fresh | kg | Yes | Yes | 2 |
| أفخاذ دجاج | Chicken Thighs | Fresh | kg | Yes | Yes | 2 |
| دجاج مشوي | Grilled Chicken | Cooked | pieces | No | Yes | 1 |
| بهارات دجاج | Chicken Spice Mix | Extras | pieces | No | No | 365 |

#### 12.1.3 Workflows
- **Live Bird Purchase**: Record total live weight, net usable meat weight → calculate shrinkage %
- **Daily Fresh Stock**: Opening stock (morning), closing stock (evening) → calculate waste/sold
- **Waste Tracking**: Mandatory for spoilage, trimming loss, unsold cooked items at end of day

---

### 12.2 Auto Service Configuration

#### 12.2.1 Categories
- Parts (قطع غيار)
  - Engine Parts (قطع محرك)
  - Brakes (فرامل)
  - Filters (فلاتر)
  - Electrical (كهرباء)
- Lubricants (زيوت)
  - Engine Oil (زيت محرك)
  - Transmission Oil (زيت ناقل حركة)
- Services (خدمات)
  - Oil Change (تغيير زيت)
  - Brake Service (خدمة فرامل)
  - Periodic Maintenance (صيانة دورية)

#### 12.2.2 Items (Examples)
| Name (AR) | Name (EN) | Category | UoM | Purchase Price | Sale Price |
|-----------|-----------|----------|-----|----------------|------------|
| بوجيات NGK | NGK Spark Plugs | Parts | pieces | 20 ILS | 50 ILS |
| زيت محرك 5W-40 | Engine Oil 5W-40 | Lubricants | L | 15 ILS/L | 30 ILS/L |
| تغيير زيت وفلتر | Oil & Filter Change | Services | service | 0 ILS | 100 ILS |

#### 12.2.3 Workflows
- **Service Tracking** (vertical-specific entity: `VehicleMaintenance`):
  - Link to vehicle (plate number, model, owner)
  - Record odometer reading
  - Service type (periodic, regular)
  - Next service date/odometer (for periodic)
  - Items used (parts + labor)
  - Total cost (parts cost + labor fee)
- **Vehicle History**: Each vehicle shows all maintenance records

---

### 12.3 Retail General Configuration

#### 12.3.1 Categories
- Clothing (ملابس)
  - Men's (رجالي)
  - Women's (نسائي)
  - Kids' (أطفال)
- Electronics (إلكترونيات)
- Home Goods (أدوات منزلية)

#### 12.3.2 Items (Examples)
| Name (AR) | Name (EN) | Category | Barcode | UoM | Size/Variant |
|-----------|-----------|----------|---------|-----|--------------|
| قميص رجالي أزرق | Men's Blue Shirt | Clothing | 1234567890123 | pieces | M, L, XL |
| سماعات بلوتوث | Bluetooth Headphones | Electronics | 9876543210987 | pieces | N/A |

#### 12.3.3 Workflows
- **Barcode-Driven Sales**: Heavy reliance on barcode scanner
- **Variants**: Support for size/color variants (single SKU with variants or separate SKUs per variant)

---

## 13. Migration & Seeding Strategy

### 13.1 New Tenant Provisioning

When a new tenant is created, the system automatically seeds:

1. **Admin User**: Default username/password (must change on first login)
2. **Default Categories**: Based on selected vertical (e.g., Fresh, Frozen, Cooked for chicken shop)
3. **Chart of Accounts Template**: Standard accounts (Assets, Liabilities, Revenue, Expenses)
4. **System Settings**: Default shop name ("محل دجاج جديد"), placeholder logo, default tax rate (17%)
5. **Sample Items** (optional): 2-3 example items to help user understand structure

---

### 13.2 Data Import (Existing Business)

For existing businesses migrating to the system:

#### 13.2.1 Master Data Import
1. **Items**: Import via Excel template (Name, Category, Barcode, Prices, etc.)
2. **Customers**: Import via Excel template (Name, Phone, Address, Credit Limit)
3. **Suppliers**: Import via Excel template (Name, Phone, Payment Terms)

#### 13.2.2 Opening Balances
1. **Opening Stock**: Import via Excel template (Item, Quantity, Unit Cost)
   - System creates `InventoryLot` for each line with `ReceivedAt = migration date`
   - No purchase reference (or optionally create dummy "Opening Stock" purchase)
2. **Customer Balances**: Import outstanding receivables
   - System creates `Debt` records (Direction: Owed_To_Me)
3. **Supplier Balances**: Import outstanding payables
   - System creates `Debt` records (Direction: I_Owe)

#### 13.2.3 Historical Transactions (Optional)
- **Note**: Not recommended due to complexity. Instead, import opening balances (stock, debts) and start fresh transactions from migration date.
- **If Required**: Import historical sales/purchases via Excel → system creates backdated transactions

---

### 13.3 Configuration Checklist (Onboarding)

For new users, the system provides an onboarding wizard:

1. **Shop Settings**: Enter shop name, upload logo, contact info
2. **Fiscal Settings**: Set fiscal year start, currency, tax rate
3. **Categories**: Create or customize categories for your vertical
4. **Items**: Import or manually add initial items
5. **Opening Stock**: Import opening inventory balances
6. **Customers/Suppliers**: Import or manually add key contacts
7. **Users**: Create additional users (cashiers, purchasers) and assign roles
8. **Printers/Devices**: Configure thermal printer, scale, barcode scanner (if applicable)
9. **Receipt Template**: Customize receipt header/footer text
10. **Test Transaction**: Create a test sale and purchase to verify setup

---

## 14. Consistency Validation

### 14.1 Schema Consistency
- ✅ Every workflow references entities that exist in the schema:
  - Procurement → Purchase, PurchaseLine, Supplier, InventoryLot, Inventory, StockMovement, Payment, Debt
  - Sales → Sale, SaleLine, SaleLineCostAllocation, Customer, InventoryLot, Inventory, StockMovement, Payment, Debt
  - Waste → InventoryAdjustment (implied via StockMovement), Inventory, InventoryLot
- ✅ Every entity has defined fields, types, constraints, indexes, relationships

### 14.2 Accounting Consistency
- ✅ Every ledger posting references valid accounts from Chart of Accounts template
- ✅ FIFO allocation logic matches entity design (SaleLineCostAllocation → InventoryLot)
- ✅ Profit calculation: `TotalProfit = TotalAmount - TotalCost` (TotalCost from FIFO allocations)
- ✅ Debt tracking: Debts created/updated/deleted based on payment status

### 14.3 UI Consistency
- ✅ Pages align with sidebar navigation:
  - Dashboard → `/`
  - Inventory → `/inventory` (+ `/inventory/new`, `/inventory/:id`, `/inventory/:id/edit`)
  - Sales → `/sales` (+ `/sales/new`, `/sales/:id`, `/sales/:id/edit`)
  - Purchasing → `/purchasing` (+ `/purchasing/new`, `/purchasing/:id`, `/purchasing/:id/edit`)
  - Customers → `/customers` (+ `/customers/:id`)
  - Suppliers → `/traders` (+ `/traders/new`, `/traders/:id`, `/traders/:id/edit`)
  - Personal Expenses → `/personal-expenses` (+ `/personal-expenses/new`, `/personal-expenses/:id/edit`)
  - Reports → (multiple sub-routes)
  - Settings → `/settings`
- ✅ All routes defined in App.tsx

### 14.4 Vertical Agnostic
- ✅ Core entities (Item, Category, Customer, Supplier, Sale, Purchase) are domain-neutral
- ✅ Vertical-specific features (e.g., VehicleMaintenance for auto service) are optional/configurable
- ✅ Configuration section explains how to adapt for different verticals (categories, items, workflows)

---

## 15. Glossary

| Term | Arabic | Definition |
|------|--------|------------|
| **POS** | نقطة البيع | Point of Sale - interface for cashier to process sales |
| **FIFO** | - | First In, First Out - inventory costing method |
| **COGS** | تكلفة البضاعة المباعة | Cost of Goods Sold - direct cost of products sold |
| **UoM** | وحدة القياس | Unit of Measure - kg, pieces, liters, etc. |
| **Receivable** | ذمم مدينة | Money owed to the business (customer debt) |
| **Payable** | ذمم دائنة | Money the business owes (supplier debt) |
| **Shrinkage** | هدر | Inventory loss (spoilage, theft, damage) |
| **Gross Profit** | الربح الإجمالي | Revenue - COGS |
| **Net Profit** | الربح الصافي | Gross Profit - Operating Expenses |
| **Credit Sale** | بيع آجل | Sale where payment is deferred (on account) |
| **VAT** | ضريبة القيمة المضافة | Value Added Tax |
| **Chart of Accounts** | دليل الحسابات | List of all accounting accounts |
| **Lot** | دفعة | Batch of inventory received in a single purchase |
| **Allocation** | تخصيص | Assignment of cost from specific lots to sale lines |
| **RLS** | - | Row-Level Security - database security feature |
| **JWT** | - | JSON Web Token - authentication token format |
| **RBAC** | - | Role-Based Access Control - permission system |
| **RTL** | - | Right-to-Left - text direction for Arabic |

---

## 16. Implementation Notes

### 16.1 Technology Stack (Recommended)
- **Frontend**: React 18+ with TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: ASP.NET Core 8.0 (C#) with Entity Framework Core
- **Database**: SQL Server (local), PostgreSQL or MySQL (cloud)
- **Authentication**: JWT with refresh tokens
- **Reporting**: QuestPDF or DinkToPDF (PDF generation), EPPlus or ClosedXML (Excel generation)
- **Hardware**: SerialPort (scale), Escpos.NET (thermal printer)

### 16.2 Development Phases

**Phase 1** (Core Features):
- Master data (Items, Customers, Suppliers)
- Sales & Purchases (FIFO costing)
- Inventory management (current stock, adjustments, waste)
- Payments & Debts
- Dashboard
- Basic reports (Sales, Inventory)

**Phase 2** (Advanced Features):
- Personal Expenses
- Advanced reports (P&L, Tax)
- Hardware integrations (printer, scale, scanner)
- PDF/Excel exports
- Multi-user & roles

**Phase 3** (Enhancements):
- Sale returns/refunds
- Period close & locking
- External accounting export
- Mobile payment integration
- Multi-location transfers

**Phase 4** (SaaS & Mobile):
- Multi-tenant SaaS platform
- Online dashboard (customer portal)
- Mobile app (POS on tablet)

---

## 17. Appendix: Configuration Layer Deep Dive

### 17.1 How to Customize for a New Vertical

**Example**: Configuring the system for a **Bakery**

#### Step 1: Define Categories
- Fresh Bread (خبز طازج)
  - White Bread (خبز أبيض)
  - Whole Wheat (قمح كامل)
  - Specialty Breads (خبز خاص)
- Pastries (معجنات)
  - Sweet (حلو)
  - Savory (مالح)
- Cakes (كيك)
  - Birthday Cakes (كيك عيد ميلاد)
  - Cupcakes (كب كيك)
- Ingredients (مكونات)
  - Flour (طحين)
  - Sugar (سكر)
  - Butter (زبدة)

#### Step 2: Create Items
| Name (AR) | Name (EN) | Category | UoM | Is Weight-Based | Is Perishable | Default Expiry Days |
|-----------|-----------|----------|-----|-----------------|---------------|---------------------|
| خبز أبيض | White Bread | Fresh Bread | pieces | No | Yes | 1 |
| كيك شوكولاتة | Chocolate Cake | Cakes | pieces | No | Yes | 3 |
| طحين | Flour | Ingredients | kg | Yes | No | 180 |

#### Step 3: Adjust Workflows
- **Daily Production**: Record ingredients used (consumption) → create "production" transaction (similar to purchase, but for internal production)
- **Custom Orders**: Add `CustomOrder` entity (optional) to track special cake orders (customer, design, pickup date)

#### Step 4: Reports
- **Production Cost Report**: Track cost of ingredients used per day/week
- **Best Sellers**: Top selling breads/cakes

---

### 17.2 Configuration vs Customization Matrix

| Requirement | Configuration (No Code) | Customization (Code Required) |
|-------------|-------------------------|-------------------------------|
| Change shop name, logo | ✅ Settings page | ❌ |
| Add new category | ✅ Settings → Categories | ❌ |
| Add new item | ✅ Inventory → New Item | ❌ |
| Change tax rate | ✅ Settings page | ❌ |
| Support new UoM (e.g., "bundles") | ✅ Add to UoM enum in settings | ⚠️ Minor code change |
| Add new report (e.g., "Supplier Performance") | ❌ | ✅ Requires backend query + frontend page |
| Support multi-location inventory | ❌ | ✅ Requires schema change (add Location entity) |
| Add new transaction type (e.g., "Production") | ❌ | ✅ Requires new entity + workflow |
| Integrate with external API (e.g., payment gateway) | ❌ | ✅ Requires backend integration code |

---

## 18. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-04 | Initial PRD based on cars project core + Chicken Shop BRD |

---

**End of Document**

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [Name] | __________ | __________ |
| Technical Lead | [Name] | __________ | __________ |
| Business Stakeholder | [Name] | __________ | __________ |
