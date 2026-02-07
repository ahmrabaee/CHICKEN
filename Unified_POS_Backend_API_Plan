# Backend API Implementation Plan

## Chicken Shop POS, Inventory & Accounting System

**Version:** 2.0  
**Last Updated:** February 7, 2026  
**Status:** Implementation Ready  
**PRD Alignment:** v2.0 (February 6, 2026)

---

## 1. Executive Summary

This document defines the RESTful API architecture for a specialized **Chicken Shop POS, Inventory & Accounting System**. The API enables:

- **Weight-based point of sale** with mandatory digital scale integration
- **FIFO inventory costing** with real-time cost allocation
- **Live bird purchase tracking** with shrinkage calculation
- **Double-entry accounting** with automated journal entries
- **Credit management** for customers and suppliers
- **Offline-first capability** for intermittent connectivity environments
- **Arabic-first localization** with RTL support

The system targets chicken retail shops (محلات الدجاج) with two user roles (Admin, Cashier) and operates on a single-database architecture optimized for SQLite with optional migration to PostgreSQL.

---

## 2. Scope & Assumptions

### 2.1 In Scope

| Domain | Capabilities |
|--------|--------------|
| **Authentication** | JWT-based auth, refresh tokens, session management |
| **User Management** | Two roles (Admin/Cashier), permissions-based access control |
| **Product Catalog** | Weight-based items, categories, barcode support |
| **Inventory** | FIFO lot tracking, stock movements, wastage recording |
| **Point of Sale** | Weight-based selling, digital scale integration, discounts |
| **Purchasing** | Live bird tracking, shrinkage calculation, goods receiving |
| **Payments** | Multi-method payments, partial payments, debt tracking |
| **Accounting** | Chart of accounts, automated journal entries, trial balance |
| **Reporting** | Sales, profit/loss, inventory valuation, wastage reports |
| **Configuration** | System settings, branch management, tax configuration |

### 2.2 Out of Scope

- Multi-currency support (single currency per deployment)
- E-commerce / online ordering
- Government tax filing automation
- HR / payroll management
- Fixed asset management
- Manufacturing / production planning
- Unit-based selling (all sales by weight only)

### 2.3 Key Assumptions

| Assumption | Value |
|------------|-------|
| Database | SQLite (single-file, offline-capable) |
| Currency | Single currency (SAR, USD, AED, IQD configurable) |
| Weight unit | Kilograms (kg) – fixed, not configurable |
| Costing method | FIFO – fixed, not configurable |
| User roles | Admin and Cashier only |
| Multi-tenant | Not supported (single database) |
| Language | Arabic primary, English secondary |
| Scale integration | Required for weight-based sales |
| Fresh chicken shelf life | 1-2 days |
| Frozen chicken shelf life | 30-90 days |
| Live bird shrinkage | 20-30% average |

---

## 3. API Architecture Overview

### 3.1 Protocol & Standards

| Aspect | Specification |
|--------|---------------|
| Protocol | HTTPS (TLS 1.2+) |
| Architecture | RESTful |
| Data Format | JSON (UTF-8) |
| Date/Time | ISO 8601 (UTC with timezone offset) |
| Monetary Values | Integer (minor units: fils/cents) |
| Weight Values | Integer (grams) |
| Pagination | Cursor-based or offset-based |
| Compression | gzip/deflate supported |

### 3.2 Base URL Structure

```
Production:  https://api.{domain}/v1
Development: http://localhost:3000/v1
```

### 3.3 API Versioning

- Version prefix in URL path: `/v1/`, `/v2/`
- Major version changes indicate breaking changes
- Deprecation notice: minimum 6 months before removal

### 3.4 Authentication Architecture

| Component | Implementation |
|-----------|----------------|
| Method | JWT (RS256 or HS256) |
| Access Token Lifetime | 15 minutes |
| Refresh Token Lifetime | 7 days |
| Token Storage | HttpOnly cookies (refresh), memory (access) |
| Session Invalidation | Server-side token blacklist |

**Authentication Flow:**

1. Client submits credentials to `/v1/auth/login`
2. Server validates and returns access token + sets refresh token cookie
3. Client includes `Authorization: Bearer {token}` on subsequent requests
4. On access token expiry, client calls `/v1/auth/refresh`

### 3.5 Authorization Model

Role-based access control (RBAC) with granular permissions:

| Role | Code | Permissions Scope |
|------|------|-------------------|
| Administrator | `admin` | Full system access |
| Cashier | `cashier` | Sales, customer queries, payment receipt, limited reports |

Permission format: `{module}.{action}` (e.g., `sales.create`, `inventory.view`)

### 3.6 Request/Response Conventions

**Standard Request Headers:**

```http
Authorization: Bearer {access_token}
Content-Type: application/json
Accept-Language: ar-SA, en-US;q=0.9
X-Branch-Id: {branch_id}  (optional, for multi-branch)
X-Request-Id: {uuid}      (optional, for tracing)
```

**Standard Success Response:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-07T10:30:00Z",
    "requestId": "uuid"
  }
}
```

**Standard Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "messageAr": "فشل التحقق",
    "details": [
      { "field": "weightGrams", "message": "Weight must be greater than 0" }
    ]
  },
  "meta": {
    "timestamp": "2026-02-07T10:30:00Z",
    "requestId": "uuid"
  }
}
```

**Pagination Response:**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 4. Endpoint Definitions

### 4.1 Authentication Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| POST | `/v1/auth/login` | Authenticate user and issue tokens | Public |
| POST | `/v1/auth/refresh` | Refresh access token | Authenticated |
| POST | `/v1/auth/logout` | Invalidate session and tokens | Authenticated |
| POST | `/v1/auth/change-password` | Change current user's password | Authenticated |

#### POST `/v1/auth/login`

**Request:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "username": "admin",
      "fullName": "مدير النظام",
      "role": "admin",
      "permissions": ["*"],
      "defaultBranchId": 1,
      "preferredLanguage": "ar"
    }
  }
}
```

**Errors:** `401 INVALID_CREDENTIALS`, `403 USER_INACTIVE`

---

### 4.2 User Management Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/users` | List all users (paginated) | Admin |
| GET | `/v1/users/{id}` | Get user details | Admin |
| GET | `/v1/users/me` | Get current user profile | Authenticated |
| POST | `/v1/users` | Create new user | Admin |
| PUT | `/v1/users/{id}` | Update user | Admin |
| PUT | `/v1/users/me` | Update own profile | Authenticated |
| DELETE | `/v1/users/{id}` | Deactivate user (soft delete) | Admin |

#### POST `/v1/users`

**Request:**
```json
{
  "username": "string (required, unique)",
  "password": "string (required, min 8 chars)",
  "fullName": "string (required)",
  "fullNameEn": "string (optional)",
  "email": "string (optional, unique)",
  "phone": "string (optional)",
  "roleId": "integer (required)",
  "defaultBranchId": "integer (optional)",
  "preferredLanguage": "ar|en (default: ar)"
}
```

**Business Rules:**
- Username must be unique
- Password minimum 8 characters
- Only Admin can assign roles
- Cannot delete the last Admin user

---

### 4.3 Branch Management Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/branches` | List all branches | Admin |
| GET | `/v1/branches/{id}` | Get branch details | Admin |
| POST | `/v1/branches` | Create branch | Admin |
| PUT | `/v1/branches/{id}` | Update branch | Admin |
| DELETE | `/v1/branches/{id}` | Deactivate branch | Admin |

---

### 4.4 Product Catalog Module

#### 4.4.1 Categories

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/categories` | List product categories | Authenticated |
| GET | `/v1/categories/{id}` | Get category details | Authenticated |
| POST | `/v1/categories` | Create category | Admin |
| PUT | `/v1/categories/{id}` | Update category | Admin |
| DELETE | `/v1/categories/{id}` | Deactivate category | Admin |

**Fixed Categories (per PRD):**

| Code | Name (Arabic) | Storage Type | Shelf Life |
|------|---------------|--------------|------------|
| `FRESH_WHOLE` | دجاج طازج كامل | Fresh | 2 days |
| `FRESH_PARTS` | قطع دجاج طازج | Fresh | 2 days |
| `FROZEN_WHOLE` | دجاج مجمد كامل | Frozen | 90 days |
| `FROZEN_PARTS` | قطع دجاج مجمد | Frozen | 90 days |
| `PROCESSED` | دجاج معالج | Fresh | 7 days |
| `EXTRAS` | إضافات | N/A | N/A |

#### 4.4.2 Items (Products)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/items` | List items (search, filter, paginated) | Authenticated |
| GET | `/v1/items/{id}` | Get item details | Authenticated |
| GET | `/v1/items/barcode/{barcode}` | Lookup item by barcode | Authenticated |
| POST | `/v1/items` | Create item | Admin |
| PUT | `/v1/items/{id}` | Update item | Admin |
| DELETE | `/v1/items/{id}` | Deactivate item | Admin |

#### GET `/v1/items`

**Query Parameters:**
- `search` - Search by name, code, or barcode
- `categoryId` - Filter by category
- `isActive` - Filter by active status
- `lowStock` - Filter items below minimum stock
- `page`, `pageSize` - Pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "CH-WHOLE-001",
      "barcode": "6281000000001",
      "name": "دجاج كامل طازج",
      "nameEn": "Fresh Whole Chicken",
      "categoryId": 1,
      "categoryName": "دجاج طازج كامل",
      "defaultSalePricePerKg": 2500,
      "defaultPurchasePricePerKg": 1800,
      "currentStockGrams": 50000,
      "minStockLevelGrams": 10000,
      "shelfLifeDays": 2,
      "storageLocation": "fridge",
      "requiresScale": true,
      "isActive": true
    }
  ],
  "pagination": { ... }
}
```

#### POST `/v1/items`

**Request:**
```json
{
  "code": "string (required, unique)",
  "barcode": "string (optional, unique)",
  "name": "string (required, Arabic)",
  "nameEn": "string (optional)",
  "categoryId": "integer (required)",
  "defaultSalePricePerKg": "integer (required, minor units)",
  "defaultPurchasePricePerKg": "integer (optional)",
  "taxRatePct": "integer (optional, basis points)",
  "minStockLevelGrams": "integer (optional)",
  "maxStockLevelGrams": "integer (optional)",
  "shelfLifeDays": "integer (optional)",
  "storageLocation": "fridge|freezer|display (optional)",
  "requiresScale": "boolean (default: true)",
  "allowNegativeStock": "boolean (default: false)"
}
```

**Business Rules:**
- All items sold by weight (kg) – no unit-based selling
- `requiresScale` defaults to true (PRD requirement)
- Price in minor units (e.g., 2500 = 25.00 SAR/kg)

---

### 4.5 Inventory Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/inventory` | Current stock summary | Authenticated |
| GET | `/v1/inventory/{itemId}` | Stock for specific item | Authenticated |
| GET | `/v1/inventory/{itemId}/lots` | FIFO lots for item | Admin |
| GET | `/v1/inventory/{itemId}/movements` | Stock movement history | Admin |
| GET | `/v1/inventory/low-stock` | Items below minimum stock | Authenticated |
| GET | `/v1/inventory/expiring` | Items expiring soon | Admin |
| POST | `/v1/inventory/adjustments` | Manual stock adjustment | Admin |
| POST | `/v1/inventory/transfers` | Branch-to-branch transfer | Admin |

#### GET `/v1/inventory`

**Query Parameters:**
- `branchId` - Filter by branch
- `categoryId` - Filter by category
- `lowStock` - Only items below minimum
- `page`, `pageSize`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "itemId": 1,
      "itemCode": "CH-WHOLE-001",
      "itemName": "دجاج كامل طازج",
      "currentQuantityGrams": 50000,
      "reservedQuantityGrams": 0,
      "availableQuantityGrams": 50000,
      "totalValue": 90000,
      "averageCostPerKg": 1800,
      "minStockLevelGrams": 10000,
      "lastRestockedAt": "2026-02-06T08:00:00Z",
      "lastSoldAt": "2026-02-07T09:30:00Z",
      "lotCount": 3
    }
  ]
}
```

#### GET `/v1/inventory/{itemId}/lots`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lotNumber": "LOT-20260206-001",
      "totalQuantityGrams": 20000,
      "remainingQuantityGrams": 15000,
      "unitPurchasePricePerKg": 1750,
      "receivedAt": "2026-02-06T08:00:00Z",
      "expiryDate": "2026-02-08T08:00:00Z",
      "purchaseNumber": "PUR-000123"
    }
  ]
}
```

#### POST `/v1/inventory/adjustments`

**Request:**
```json
{
  "itemId": "integer (required)",
  "lotId": "integer (optional, for specific lot)",
  "adjustmentType": "increase|decrease (required)",
  "quantityGrams": "integer (required, positive)",
  "reason": "string (required)",
  "unitCost": "integer (optional, for increases)"
}
```

**Business Rules:**
- Creates stock movement record
- Updates inventory totals
- Logs to audit trail

---

### 4.6 Wastage Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/wastage` | List wastage records | Admin |
| GET | `/v1/wastage/{id}` | Get wastage details | Admin |
| POST | `/v1/wastage` | Record wastage/spoilage | Admin |
| PUT | `/v1/wastage/{id}/approve` | Approve wastage record | Admin |

#### POST `/v1/wastage`

**Request:**
```json
{
  "itemId": "integer (required)",
  "lotId": "integer (optional)",
  "weightGrams": "integer (required)",
  "wastageType": "spoilage|trimming|expired|damaged|end_of_day|other (required)",
  "reason": "string (required)",
  "photoUrl": "string (optional)",
  "notes": "string (optional)"
}
```

**Wastage Types (per PRD):**
- `spoilage` – Chicken went bad (temperature, time)
- `trimming` – Normal trimming/cleaning loss
- `expired` – Past shelf life
- `damaged` – Physical damage
- `end_of_day` – Unsold fresh chicken at close
- `other` – Other reasons

**Business Rules:**
- Calculates `estimatedCostValue` from FIFO lot
- Creates negative stock movement
- Updates inventory totals
- Daily wastage reports required for fresh chicken

---

### 4.7 Sales Module (POS)

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/sales` | List sales (filtered, paginated) | Admin: all, Cashier: own |
| GET | `/v1/sales/{id}` | Get sale details with cost allocation | Authenticated |
| GET | `/v1/sales/{id}/receipt` | Get receipt data for printing | Authenticated |
| POST | `/v1/sales` | Create new sale | Admin, Cashier |
| POST | `/v1/sales/{id}/void` | Void sale | Admin only |
| POST | `/v1/sales/{id}/payments` | Add payment to sale | Authenticated |

#### POST `/v1/sales`

**Request:**
```json
{
  "customerId": "integer (optional, null for walk-in)",
  "customerName": "string (optional, for walk-in)",
  "customerPhone": "string (optional)",
  "saleType": "cash|credit|mixed (required)",
  "discountAmount": "integer (optional, minor units)",
  "discountPct": "integer (optional, basis points)",
  "dueDate": "date (required if credit)",
  "notes": "string (optional)",
  "lines": [
    {
      "itemId": "integer (required)",
      "weightGrams": "integer (required)",
      "pricePerKg": "integer (required, minor units)",
      "discountAmount": "integer (optional)"
    }
  ],
  "payments": [
    {
      "amount": "integer (required)",
      "paymentMethod": "cash|card|bank_transfer|mobile|check (required)"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "saleNumber": "SAL-000042",
    "saleDate": "2026-02-07T10:30:00Z",
    "saleType": "cash",
    "customerId": null,
    "customerName": "زبون عابر",
    "grossTotalAmount": 5000,
    "discountAmount": 0,
    "taxAmount": 750,
    "totalAmount": 5750,
    "totalCost": 3600,
    "totalProfit": 2150,
    "paymentStatus": "paid",
    "amountPaid": 5750,
    "amountDue": 0,
    "lines": [
      {
        "id": 101,
        "lineNumber": 1,
        "itemId": 1,
        "itemName": "دجاج كامل طازج",
        "itemCode": "CH-WHOLE-001",
        "weightGrams": 2000,
        "pricePerKg": 2500,
        "lineTotalAmount": 5750,
        "costPerKg": 1800,
        "lineTotalCost": 3600,
        "lineProfit": 2150,
        "costAllocations": [
          {
            "lotId": 1,
            "lotNumber": "LOT-20260206-001",
            "quantityAllocatedGrams": 2000,
            "unitCostPerKg": 1800,
            "totalCost": 3600
          }
        ]
      }
    ]
  }
}
```

**Business Rules (per PRD):**

1. **FIFO Cost Allocation:**
   - Consume oldest lots first based on `receivedAt`
   - Create `SaleLineCostAllocation` for each lot consumed
   - Calculate `lineTotalCost` as sum of allocations

2. **Stock Validation:**
   - Check available stock before sale
   - Block if `allowNegativeStock = false` and insufficient stock
   - Error: `INSUFFICIENT_STOCK` with available quantity

3. **Scale Requirement:**
   - If `item.requiresScale = true`, validate weight reading
   - Store scale reading in metadata for audit

4. **Discount Limits (Cashier):**
   - Cashier limited to 5% maximum discount
   - Admin can apply any discount
   - Error: `DISCOUNT_LIMIT_EXCEEDED`

5. **Credit Limit Check:**
   - For credit sales, validate customer's credit limit
   - Block if `newBalance > creditLimit`
   - Error: `CREDIT_LIMIT_EXCEEDED`

6. **Auto Debt Creation:**
   - If `amountDue > 0`, create `Debt` record
   - Direction: `receivable` (customer owes us)

7. **Accounting Entry:**
   - Auto-generate journal entry:
     - Debit: Cash/AR account
     - Credit: Sales Revenue account
     - Debit: COGS account
     - Credit: Inventory account

#### POST `/v1/sales/{id}/void`

**Request:**
```json
{
  "reason": "string (required)"
}
```

**Business Rules:**
- Admin only
- Cannot void after end-of-day close
- Reverses inventory (restore lot quantities)
- Reverses payments (refund or credit)
- Deletes associated debt
- Creates reversing journal entry
- Logs to audit trail

---

### 4.8 Purchases Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/purchases` | List purchases | Admin |
| GET | `/v1/purchases/{id}` | Get purchase details | Admin |
| POST | `/v1/purchases` | Create purchase order | Admin |
| PUT | `/v1/purchases/{id}` | Update purchase | Admin |
| POST | `/v1/purchases/{id}/receive` | Receive goods | Admin |
| POST | `/v1/purchases/{id}/approve` | Approve purchase | Admin |
| POST | `/v1/purchases/{id}/payments` | Add payment | Admin |

#### POST `/v1/purchases`

**Request:**
```json
{
  "supplierId": "integer (required)",
  "supplierInvoiceNumber": "string (optional)",
  "purchaseDate": "date (optional, defaults to now)",
  "dueDate": "date (optional)",
  "notes": "string (optional)",
  "lines": [
    {
      "itemId": "integer (required)",
      "weightGrams": "integer (required)",
      "pricePerKg": "integer (required, minor units)",
      "taxRatePct": "integer (optional)",
      "expiryDate": "date (optional)",
      "isLiveBird": "boolean (default: false)",
      "liveBirdData": {
        "grossWeightGrams": "integer (if live bird)",
        "netWeightGrams": "integer (if live bird)",
        "shrinkagePct": "number (calculated)",
        "pricePerBird": "integer (optional)"
      }
    }
  ]
}
```

#### POST `/v1/purchases/{id}/receive`

**Request:**
```json
{
  "receivedAt": "datetime (optional, defaults to now)",
  "lines": [
    {
      "purchaseLineId": "integer (required)",
      "receivedWeightGrams": "integer (required)",
      "lotNumber": "string (optional, auto-generated if not provided)",
      "expiryDate": "date (optional)",
      "liveBirdData": {
        "grossWeightGrams": "integer (if live bird)",
        "netWeightGrams": "integer (actual net after processing)"
      }
    }
  ]
}
```

**Business Rules (per PRD):**

1. **Live Bird Processing:**
   - Track gross weight (before slaughter)
   - Track net weight (after processing)
   - Calculate shrinkage: `(gross - net) / gross * 100`
   - Real cost per kg: `lineTotalAmount / netWeightGrams`

2. **Lot Creation:**
   - Create `InventoryLot` for each line
   - Set `receivedAt` for FIFO ordering
   - Calculate expiry from item's `shelfLifeDays`

3. **Stock Update:**
   - Create positive stock movement
   - Update inventory totals

4. **Auto Debt Creation:**
   - If payment due, create `Debt` record
   - Direction: `payable` (we owe supplier)

5. **Accounting Entry:**
   - Debit: Inventory account
   - Credit: AP/Cash account

---

### 4.9 Customers Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/customers` | List customers | Authenticated |
| GET | `/v1/customers/{id}` | Get customer details | Authenticated |
| GET | `/v1/customers/{id}/debts` | Customer's receivables | Authenticated |
| GET | `/v1/customers/{id}/sales` | Customer's sales history | Authenticated |
| GET | `/v1/customers/search` | Search by phone/name | Authenticated |
| POST | `/v1/customers` | Create customer | Authenticated |
| PUT | `/v1/customers/{id}` | Update customer | Admin |
| PUT | `/v1/customers/{id}/credit-limit` | Set credit limit | Admin |

#### GET `/v1/customers/search`

**Query Parameters:**
- `q` - Search term (phone or name)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "customerNumber": "CUST-000005",
      "name": "أحمد محمد",
      "phone": "0501234567",
      "creditLimit": 500000,
      "currentBalance": 125000,
      "availableCredit": 375000,
      "priceLevel": "standard"
    }
  ]
}
```

---

### 4.10 Suppliers Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/suppliers` | List suppliers | Admin |
| GET | `/v1/suppliers/{id}` | Get supplier details | Admin |
| GET | `/v1/suppliers/{id}/debts` | Supplier's payables | Admin |
| GET | `/v1/suppliers/{id}/purchases` | Purchase history | Admin |
| POST | `/v1/suppliers` | Create supplier | Admin |
| PUT | `/v1/suppliers/{id}` | Update supplier | Admin |

---

### 4.11 Payments Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/payments` | List payments | Admin |
| GET | `/v1/payments/{id}` | Get payment details | Admin |
| POST | `/v1/payments` | Record payment | Admin: all, Cashier: receipts only |
| POST | `/v1/payments/{id}/void` | Void payment | Admin |

#### POST `/v1/payments`

**Request:**
```json
{
  "referenceType": "sale|purchase|expense|debt (required)",
  "referenceId": "integer (required)",
  "amount": "integer (required, minor units)",
  "paymentMethod": "cash|card|bank_transfer|mobile|check (required)",
  "paymentDate": "datetime (optional)",
  "receiptNumber": "string (optional)",
  "bankTransactionId": "string (optional)",
  "notes": "string (optional)"
}
```

**Business Rules:**
- Updates payment status on referenced entity
- Updates debt record if exists
- Creates accounting entry
- Cashier can only receive payments (customer → shop)
- Admin can make payments (shop → supplier)

---

### 4.12 Debts Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/debts` | List all debts | Admin |
| GET | `/v1/debts/receivables` | Customer debts (owed to us) | Authenticated |
| GET | `/v1/debts/payables` | Supplier debts (we owe) | Admin |
| GET | `/v1/debts/{id}` | Get debt details | Admin |
| GET | `/v1/debts/overdue` | Overdue debts | Admin |
| POST | `/v1/debts/{id}/write-off` | Write off bad debt | Admin |

#### GET `/v1/debts`

**Query Parameters:**
- `direction` - `receivable|payable`
- `partyType` - `customer|supplier`
- `partyId` - Filter by party
- `status` - `open|partial|paid|overdue|written_off`
- `dueBefore` - Filter by due date
- `page`, `pageSize`

---

### 4.13 Expenses Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/expenses` | List expenses | Admin |
| GET | `/v1/expenses/{id}` | Get expense details | Admin |
| GET | `/v1/expense-categories` | List expense categories | Admin |
| POST | `/v1/expenses` | Create expense | Admin |
| PUT | `/v1/expenses/{id}` | Update expense | Admin |
| POST | `/v1/expenses/{id}/approve` | Approve expense | Admin |
| DELETE | `/v1/expenses/{id}` | Delete expense | Admin |

#### POST `/v1/expenses`

**Request:**
```json
{
  "expenseDate": "date (optional)",
  "expenseType": "operational|personal|payroll|utilities|rent|maintenance|other (required)",
  "categoryId": "integer (optional)",
  "amount": "integer (required, minor units)",
  "taxAmount": "integer (optional)",
  "description": "string (required)",
  "supplierId": "integer (optional)",
  "paymentMethod": "cash|card|bank_transfer (optional)",
  "referenceNumber": "string (optional)",
  "attachmentUrl": "string (optional)"
}
```

---

### 4.14 Accounting Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/accounts` | Chart of accounts | Admin |
| GET | `/v1/accounts/{code}` | Account details | Admin |
| GET | `/v1/accounts/{code}/balance` | Account balance | Admin |
| GET | `/v1/journal-entries` | List journal entries | Admin |
| GET | `/v1/journal-entries/{id}` | Journal entry details | Admin |
| POST | `/v1/journal-entries` | Create manual entry | Admin |
| POST | `/v1/journal-entries/{id}/post` | Post journal entry | Admin |
| POST | `/v1/journal-entries/{id}/reverse` | Reverse journal entry | Admin |

#### POST `/v1/journal-entries`

**Request:**
```json
{
  "entryDate": "date (optional)",
  "description": "string (required)",
  "lines": [
    {
      "accountCode": "string (required)",
      "debitAmount": "integer (optional, minor units)",
      "creditAmount": "integer (optional, minor units)",
      "description": "string (optional)"
    }
  ]
}
```

**Business Rules:**
- Total debits must equal total credits
- Each line must have either debit or credit (not both)
- System-generated entries auto-posted
- Manual entries require explicit posting

---

### 4.15 Reports Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/reports/dashboard` | Dashboard summary | Authenticated |
| GET | `/v1/reports/sales-summary` | Sales summary report | Admin |
| GET | `/v1/reports/profit-loss` | Profit & Loss statement | Admin |
| GET | `/v1/reports/inventory-valuation` | Inventory valuation (FIFO) | Admin |
| GET | `/v1/reports/stock-movements` | Stock movement report | Admin |
| GET | `/v1/reports/wastage-summary` | Wastage report | Admin |
| GET | `/v1/reports/top-items` | Top selling items | Admin |
| GET | `/v1/reports/customer-balances` | Customer balance report | Admin |
| GET | `/v1/reports/supplier-balances` | Supplier balance report | Admin |
| GET | `/v1/reports/trial-balance` | Trial balance | Admin |
| GET | `/v1/reports/vat-summary` | VAT/Tax summary | Admin |
| GET | `/v1/reports/daily-sales` | Daily sales report | Authenticated |

#### GET `/v1/reports/dashboard`

**Query Parameters:**
- `branchId` - Filter by branch (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "salesToday": {
      "count": 45,
      "totalAmount": 1250000,
      "totalProfit": 312500
    },
    "salesThisWeek": {
      "count": 280,
      "totalAmount": 8750000
    },
    "receivables": {
      "totalOutstanding": 450000,
      "overdueAmount": 125000,
      "overdueCount": 8
    },
    "payables": {
      "totalOutstanding": 280000,
      "overdueAmount": 0
    },
    "inventory": {
      "totalValue": 1850000,
      "lowStockCount": 3,
      "expiringTodayCount": 2
    },
    "wastageToday": {
      "weightGrams": 5000,
      "estimatedValue": 12500
    }
  }
}
```

#### GET `/v1/reports/profit-loss`

**Query Parameters:**
- `startDate` - Period start (required)
- `endDate` - Period end (required)
- `branchId` - Filter by branch (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2026-02-01",
      "endDate": "2026-02-07"
    },
    "revenue": {
      "grossSales": 8750000,
      "discounts": 175000,
      "netSales": 8575000
    },
    "costOfGoodsSold": 5400000,
    "grossProfit": 3175000,
    "grossProfitMargin": 37.03,
    "expenses": {
      "operational": 450000,
      "utilities": 85000,
      "rent": 200000,
      "payroll": 350000,
      "other": 45000,
      "total": 1130000
    },
    "wastage": 125000,
    "netProfit": 1920000,
    "netProfitMargin": 22.40
  }
}
```

---

### 4.16 Settings Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/settings` | Get all settings | Admin |
| GET | `/v1/settings/{key}` | Get specific setting | Admin |
| PUT | `/v1/settings` | Update settings (batch) | Admin |
| PUT | `/v1/settings/{key}` | Update single setting | Admin |

#### GET `/v1/settings`

**Response:**
```json
{
  "success": true,
  "data": {
    "general": {
      "businessName": "الفروج الذهبي",
      "businessNameEn": "Golden Chicken",
      "currency": "SAR",
      "currencySymbol": "ر.س",
      "language": "ar"
    },
    "tax": {
      "taxEnabled": true,
      "taxRate": 1500,
      "taxLabel": "ضريبة القيمة المضافة"
    },
    "inventory": {
      "allowNegativeStock": false,
      "freshChickenShelfLifeDays": 2,
      "frozenChickenShelfLifeDays": 90,
      "defaultShrinkagePct": 2500
    },
    "scale": {
      "scaleComPort": "COM3",
      "scaleBaudRate": 9600,
      "requireScaleReading": true
    },
    "numbering": {
      "saleNumberPrefix": "SAL-",
      "purchaseNumberPrefix": "PUR-",
      "nextSaleNumber": 43
    }
  }
}
```

---

### 4.17 Audit Log Module

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|--------|
| GET | `/v1/audit-logs` | List audit logs | Admin |
| GET | `/v1/audit-logs/{id}` | Get log details | Admin |

#### GET `/v1/audit-logs`

**Query Parameters:**
- `entityType` - Filter by entity (sale, purchase, etc.)
- `entityId` - Filter by entity ID
- `userId` - Filter by user
- `action` - Filter by action (create, update, delete, void)
- `startDate`, `endDate` - Date range
- `page`, `pageSize`

---

## 5. Data Models

### 5.1 Entity Relationship Summary

```
Branch (1) ─────────── (N) User
Branch (1) ─────────── (N) Sale
Branch (1) ─────────── (N) Purchase
Branch (1) ─────────── (N) Inventory

User (N) ──────────── (M) Role (via UserRole)
User (1) ─────────── (N) Sale (as Cashier)
User (1) ─────────── (N) AuditLog

Category (1) ────────── (N) Item

Item (1) ─────────── (1) Inventory
Item (1) ─────────── (N) InventoryLot
Item (1) ─────────── (N) SaleLine
Item (1) ─────────── (N) PurchaseLine
Item (1) ─────────── (N) WastageRecord

InventoryLot (1) ──── (N) SaleLineCostAllocation
InventoryLot (1) ──── (N) StockMovement

Customer (1) ────────── (N) Sale
Customer (1) ────────── (N) Debt (direction: receivable)

Supplier (1) ────────── (N) Purchase
Supplier (1) ────────── (N) Debt (direction: payable)

Sale (1) ──────────── (N) SaleLine
Sale (1) ──────────── (N) Payment
Sale (1) ──────────── (0..1) Debt

SaleLine (1) ────────── (N) SaleLineCostAllocation

Purchase (1) ────────── (N) PurchaseLine
Purchase (1) ────────── (N) InventoryLot
Purchase (1) ────────── (N) Payment
Purchase (1) ────────── (0..1) Debt

Account (1) ────────── (N) JournalEntryLine
JournalEntry (1) ──── (N) JournalEntryLine
```

### 5.2 Core Entity Reference

| Entity | Primary Key | Key Fields |
|--------|-------------|------------|
| Branch | id (int) | code, name, isMainBranch |
| User | id (int) | username, email, passwordHash |
| Role | id (int) | name (admin/cashier), permissions |
| Category | id (int) | code, name, storageType |
| Item | id (int) | code, barcode, name, defaultSalePricePerKg |
| Inventory | id (int) | itemId, currentQuantityGrams, totalValue |
| InventoryLot | id (int) | lotNumber, remainingQuantityGrams, unitPurchasePrice |
| Customer | id (int) | customerNumber, name, phone, creditLimit |
| Supplier | id (int) | supplierNumber, name, paymentTerms |
| Sale | id (int) | saleNumber, saleDate, totalAmount, paymentStatus |
| SaleLine | id (int) | saleId, itemId, weightGrams, pricePerKg |
| SaleLineCostAllocation | id (int) | saleLineId, lotId, quantityAllocatedGrams |
| Purchase | id (int) | purchaseNumber, supplierId, totalAmount |
| PurchaseLine | id (int) | purchaseId, itemId, weightGrams, isLiveBird |
| Payment | id (int) | paymentNumber, referenceType, referenceId, amount |
| Debt | id (int) | debtNumber, direction, partyId, totalAmount |
| WastageRecord | id (int) | itemId, weightGrams, wastageType |
| Expense | id (int) | expenseNumber, amount, expenseType |
| Account | id (int) | code, name, accountType |
| JournalEntry | id (int) | entryNumber, entryDate, isPosted |
| AuditLog | id (int) | timestamp, entityType, entityId, action |

### 5.3 Value Conventions

| Data Type | Storage | Unit | Example |
|-----------|---------|------|---------|
| Currency | Integer | Minor units (fils/cents) | 2500 = 25.00 |
| Weight | Integer | Grams | 1500 = 1.5 kg |
| Percentage | Integer | Basis points (1/100 of %) | 1500 = 15% |
| Date/Time | ISO 8601 | UTC | 2026-02-07T10:30:00Z |

---

## 6. Security & Compliance

### 6.1 Authentication Security

| Control | Implementation |
|---------|----------------|
| Password hashing | bcrypt (cost factor: 12) |
| Token signing | RS256 or HS256 (configurable) |
| Token storage | Access: memory, Refresh: HttpOnly cookie |
| Session invalidation | Server-side token blacklist |
| Brute force protection | Rate limiting (5 attempts/minute) |
| Account lockout | After 10 failed attempts (30 min) |

### 6.2 Authorization Matrix

| Module | Admin | Cashier |
|--------|-------|---------|
| Sales – Create | ✓ | ✓ |
| Sales – View All | ✓ | Own only |
| Sales – Void | ✓ | ✗ |
| Sales – Discount > 5% | ✓ | ✗ |
| Purchases | ✓ | ✗ |
| Inventory – View | ✓ | Basic only |
| Inventory – Adjust | ✓ | ✗ |
| Wastage | ✓ | ✗ |
| Customers – Create | ✓ | ✓ |
| Customers – Edit | ✓ | ✗ |
| Customers – Credit Limit | ✓ | ✗ |
| Suppliers | ✓ | ✗ |
| Payments – Receive | ✓ | ✓ |
| Payments – Disburse | ✓ | ✗ |
| Expenses | ✓ | ✗ |
| Reports – Daily Sales | ✓ | Own only |
| Reports – Financial | ✓ | ✗ |
| Settings | ✓ | ✗ |
| Users | ✓ | ✗ |

### 6.3 Data Protection

| Control | Implementation |
|---------|----------------|
| Transport | TLS 1.2+ required |
| Input validation | Schema validation on all inputs |
| SQL injection | Prisma ORM parameterized queries |
| XSS | Content-Type: application/json enforcement |
| CORS | Whitelist allowed origins |
| Rate limiting | 100 requests/minute per user |

### 6.4 Audit Requirements

All sensitive operations logged to `AuditLog`:

| Action | Logged Fields |
|--------|---------------|
| Login/Logout | userId, timestamp, ipAddress |
| Sale Create/Void | saleId, amount, items, reason |
| Purchase Create | purchaseId, supplierId, amount |
| Payment | paymentId, referenceType, amount |
| Inventory Adjustment | itemId, quantity, reason |
| Wastage | itemId, quantity, type, reason |
| User Create/Update | userId, changedFields |
| Settings Change | key, oldValue, newValue |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target |
|--------|--------|
| API response time (p50) | < 100ms |
| API response time (p95) | < 500ms |
| POS transaction completion | < 3 seconds |
| Dashboard load time | < 2 seconds |
| Report generation (30 days) | < 5 seconds |
| Concurrent users | 10 per branch |

### 7.2 Scalability

| Aspect | Specification |
|--------|---------------|
| Database | SQLite (single-file, up to 140TB) |
| Horizontal scaling | Not required (single instance) |
| Data retention | 7 years (legal requirement) |
| Transactions/day | Up to 10,000 |
| Items catalog | Up to 1,000 |

### 7.3 Availability

| Metric | Target |
|--------|--------|
| Uptime | 99% (during business hours) |
| Planned maintenance | Off-hours only |
| Data backup | Daily automated |
| Recovery time objective (RTO) | < 1 hour |
| Recovery point objective (RPO) | < 24 hours |

### 7.4 Offline Capability

| Requirement | Implementation |
|-------------|----------------|
| Offline POS | Local SQLite database |
| Sync strategy | Eventual consistency |
| Conflict resolution | Last-write-wins with audit |
| Queue persistence | Local storage for pending syncs |

### 7.5 Logging & Monitoring

| Component | Implementation |
|-----------|----------------|
| Application logs | Structured JSON logging |
| Log levels | Error, Warn, Info, Debug |
| Request tracing | Correlation ID in headers |
| Error tracking | Stack traces in logs |
| Health check | `GET /health` endpoint |

---

## 8. Dependencies & Integrations

### 8.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5+ |
| Framework | Express.js or Fastify |
| ORM | Prisma |
| Database | SQLite (dev/prod) |
| Authentication | JWT (jsonwebtoken) |
| Validation | Zod or Joi |
| Password hashing | bcrypt |
| Testing | Vitest |

### 8.2 Hardware Integrations

| Device | Protocol | Notes |
|--------|----------|-------|
| Digital Scale | Serial (COM port) | Required for weight-based sales |
| Thermal Printer | ESC/POS | Receipt printing |
| Barcode Scanner | USB HID | Product lookup |

### 8.3 External Integrations

None required per PRD. Future considerations:
- Cloud backup (optional)
- SMS notifications (optional)

---

## 9. Error Handling Conventions

### 9.1 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PUT) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (auth required) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate, business rule) |
| 422 | Unprocessable Entity (business logic error) |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### 9.2 Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_CREDENTIALS` | Login failed |
| `TOKEN_EXPIRED` | Access token expired |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE_ENTRY` | Unique constraint violation |
| `INSUFFICIENT_STOCK` | Not enough inventory |
| `CREDIT_LIMIT_EXCEEDED` | Customer credit limit reached |
| `DISCOUNT_LIMIT_EXCEEDED` | Cashier discount limit exceeded |
| `SALE_ALREADY_VOIDED` | Cannot void twice |
| `CANNOT_VOID_AFTER_CLOSE` | End of day already processed |
| `SCALE_REQUIRED` | Weight reading required |
| `SCALE_UNSTABLE` | Scale reading not stable |
| `EXPIRED_PRODUCT` | Product past shelf life |
| `DEBIT_CREDIT_MISMATCH` | Journal entry unbalanced |

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

- Authentication & authorization
- User management
- Branch configuration
- Categories & Items
- Base inventory structure

### Phase 2: Core Operations (Weeks 5-9)

- Sales (POS flow with FIFO)
- Purchases & goods receiving
- Live bird tracking
- Payments processing
- Debt management

### Phase 3: Inventory & Wastage (Weeks 10-12)

- Lot management
- Stock movements
- Adjustments
- Wastage recording
- Low stock alerts

### Phase 4: Accounting (Weeks 13-15)

- Chart of accounts
- Automated journal entries
- Manual journal entries
- Trial balance

### Phase 5: Reporting & Polish (Weeks 16-18)

- Dashboard
- All reports
- Settings management
- Audit logs
- Performance optimization
- API documentation

---

## 11. Risks & Open Questions

### 11.1 Identified Risks

| Risk | Mitigation |
|------|------------|
| Scale integration complexity | Standard serial protocol, fallback to manual entry |
| Offline sync conflicts | Last-write-wins with comprehensive audit trail |
| FIFO calculation performance | Database indexes, caching |
| Arabic text handling | UTF-8 throughout, RTL-aware responses |

### 11.2 Open Questions

1. **Receipt template customization:** Can customers customize receipt layout, or is a standard template sufficient?

2. **Multi-branch inventory transfer:** Should transfers require approval workflow?

3. **End-of-day process:** Is there a formal EOD close that blocks same-day voids?

4. **Fiscal year closing:** Are year-end journal entries required?

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2026 | — | Initial draft |
| 2.0 | Feb 7, 2026 | — | Full PRD alignment, removed multi-tenant, added chicken-shop specifics |

---

*This document serves as the authoritative API specification aligned with PRD v2.0. All implementation must conform to this specification.*
