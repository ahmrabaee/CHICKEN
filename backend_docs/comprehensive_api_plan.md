# Comprehensive Backend API Plan
## Business & Accounting Logic Implementation

> [!IMPORTANT]
> This plan covers **ALL** backend APIs needed to support the PRD requirements, including business logic, accounting rules, and data validation.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Module 1: Authentication & Setup](#module-1-authentication--setup)
3. [Module 2: User Management](#module-2-user-management)
4. [Module 3: Branch Management](#module-3-branch-management)
5. [Module 4: Inventory Management](#module-4-inventory-management)
6. [Module 5: Sales & POS](#module-5-sales--pos)
7. [Module 6: Purchases & Suppliers](#module-6-purchases--suppliers)
8. [Module 7: Customers & Debt Management](#module-7-customers--debt-management)
9. [Module 8: Payments](#module-8-payments)
10. [Module 9: Returns & Wastage](#module-9-returns--wastage)
11. [Module 10: Reporting](#module-10-reporting)
12. [Module 11: Accounting](#module-11-accounting)
13. [Cross-Cutting Concerns](#cross-cutting-concerns)

---

## Core Principles

### Business Logic Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Batch Tracking** | All inventory tracked by lot with supplier, date, expiry |
| **FIFO Costing** | Sales automatically allocated to oldest batches first |
| **Profit Calculation** | Real-time profit = sale price - FIFO cost |
| **Automatic Debt** | Credit sales auto-create debt records |
| **Payment Installments** | Track partial payments with remaining balance |
| **Expiry Alerts** | System alerts for batches nearing expiry |
| **Role-Based Access** | Admin sees all, cashier sees limited data |
| **Bilingual Support** | All responses include Arabic and English |

### Accounting Principles

| Principle | Implementation |
|-----------|----------------|
| **Double-Entry** | All transactions create balanced journal entries |
| **Chart of Accounts** | Pre-seeded with business-appropriate accounts |
| **Automatic Posting** | Sales, purchases, payments auto-generate entries |
| **Cost Tracking** | FIFO cost allocation for COGS calculation |
| **Financial Reports** | Income statement, balance sheet from journal |

---

## Module 1: Authentication & Setup

### Endpoints

#### 1.1 Check Setup Status
```http
GET /auth/check-setup
```

**Public Endpoint** (no authentication required)

**Response:**
```typescript
{
  setupCompleted: boolean;
  businessName?: string;     // Only if setup complete
  businessNameEn?: string;   // Only if setup complete
}
```

**Business Logic:**
- Query `system_settings` table for `setup_completed` key
- If true, also return business names

#### 1.2 Complete First-Time Setup
```http
POST /auth/setup
```

**Public Endpoint** (one-time use)

**Request Body:**
```typescript
{
  businessName: string;        // Required, Arabic
  businessNameEn?: string;     // Optional, English
  adminUsername: string;       // Min 3 chars
  adminPassword: string;       // Min 8 chars, strong
  adminFullName: string;       // Arabic
  adminFullNameEn?: string;    // English
  preferredLanguage: 'ar' | 'en';
}
```

**Response:**
```typescript
{
  message: string;
  messageAr: string;
  accessToken: string;       // Auto-login
  refreshToken: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    role: 'admin';
    permissions: string[];
  }
}
```

**Business Logic:**
1. ✅ Verify setup not already complete
2. ✅ Create main branch (code: 'MAIN', isMainBranch: true)
3. ✅ Hash admin password (bcrypt, 12 rounds)
4. ✅ Create admin user with session token
5. ✅ Assign admin role
6. ✅ Update system settings (setup_completed, business_name, etc.)
7. ✅ Generate JWT tokens for auto-login
8. ✅ Create audit log entry

**Validation:**
- Username must be unique
- Password min 8 chars
- Business name required

**Error Codes:**
- `SETUP_ALREADY_COMPLETE` - Setup already done
- `INVALID_PASSWORD` - Password too weak
- `DATABASE_ERROR` - Transaction failed

#### 1.3 Login
```http
POST /auth/login
```

**Request Body:**
```typescript
{
  username: string;
  password: string;
}
```

**Response:**
```typescript
{
  accessToken: string;
  expiresIn: number;         // Seconds (900 = 15min)
  refreshToken: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    role: string;
    permissions: string[];
    defaultBranchId?: number;
    preferredLanguage: string;
  }
}
```

**Business Logic:**
1. ✅ Validate credentials (bcrypt compare)
2. ✅ Check user is active
3. ✅ Generate session token (UUID v4)
4. ✅ Set session expiry (7 days matching refresh token)
5. ✅ Update `currentSessionToken` and `currentSessionExpiry`
6. ✅ Update `lastLoginAt`
7. ✅ Generate JWT access + refresh tokens
8. ✅ Store hashed refresh token in DB
9. ✅ Create audit log entry

**Error Codes:**
- `INVALID_CREDENTIALS` - Wrong username/password
- `USER_INACTIVE` - Account deactivated
- `SETUP_NOT_COMPLETE` - System not initialized

#### 1.4 Logout
```http
POST /auth/logout
```

**Headers:** `Authorization: Bearer <access_token>`

**Business Logic:**
1. ✅ Clear `currentSessionToken` and `currentSessionExpiry`
2. ✅ Clear `refreshToken` and `refreshTokenExpiresAt`
3. ✅ Create audit log entry

**Response:**
```typescript
{
  message: 'Logged out successfully';
  messageAr: 'تم تسجيل الخروج بنجاح';
}
```

#### 1.5 Change Password
```http
POST /auth/change-password
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```typescript
{
  oldPassword: string;
  newPassword: string;    // Min 8 chars
}
```

**Business Logic:**
1. ✅ Verify old password
2. ✅ Hash new password (bcrypt, 12 rounds)
3. ✅ Update password
4. ✅ **Clear ALL sessions** (security measure)
5. ✅ Create audit log entry

**Response:**
```typescript
{
  message: 'Password changed successfully. Please log in again.';
  messageAr: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.';
}
```

**Error Codes:**
- `INVALID_OLD_PASSWORD` - Old password incorrect
- `WEAK_PASSWORD` - New password too weak

---

## Module 2: User Management

### Endpoints

#### 2.1 List Users
```http
GET /users?page=1&pageSize=20&isActive=true&isLoggedIn=false&roleId=1&search=ahmad
```

**Permissions:** `admin` only

**Query Parameters:**
- `page` (optional): Page number, default 1
- `pageSize` (optional): Items per page, default 20
- `isActive` (optional): Filter by active status
- `isLoggedIn` (optional): Filter by login status
- `roleId` (optional): Filter by role
- `search` (optional): Search username, fullName, email

**Response:**
```typescript
{
  items: [
    {
      id: number;
      username: string;
      fullName: string;
      fullNameEn?: string;
      email?: string;
      phone?: string;
      preferredLanguage: string;
      defaultBranchId?: number;
      defaultBranchName?: string;    // NEW - Computed
      isActive: boolean;
      roles: string[];
      lastLoginAt?: string;
      isLoggedIn: boolean;            // NEW - Computed
      workStartDate: string;          // NEW - From DB
      createdAt: string;
    }
  ];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }
}
```

**Business Logic:**
- **isLoggedIn** computed as: `currentSessionExpiry > NOW()`
- **defaultBranchName** fetched via join
- **workStartDate** from DB field

#### 2.2 Get Active Sessions
```http
GET /users/active-sessions
```

**Permissions:** `admin` only

**Response:**
```typescript
{
  activeCount: number;
  users: [
    {
      id: number;
      fullName: string;
      username: string;
      lastLoginAt: string;
      sessionExpiresAt: string;
    }
  ]
}
```

**Business Logic:**
- Query users where `currentSessionExpiry > NOW()`
- Order by `lastLoginAt DESC`

#### 2.3 Create User
```http
POST /users
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  username: string;           // Min 3 chars, unique
  password: string;           // Min 8 chars
  fullName: string;           // Required
  fullNameEn?: string;
  email?: string;             // Unique if provided
  phone?: string;
  preferredLanguage: 'ar' | 'en';
  defaultBranchId?: number;
  roleId: number;             // 1=admin, 2=cashier
}
```

**Response:**
```typescript
{
  id: number;
  username: string;
  fullName: string;
  // ... all user fields ...
}
```

**Business Logic:**
1. ✅ Validate username unique
2. ✅ Validate email unique (if provided)
3. ✅ Verify role exists
4. ✅ Verify branch exists (if provided)
5. ✅ Hash password (bcrypt, 12 rounds)
6. ✅ Set `workStartDate` to NOW (automatic)
7. ✅ Create user + role assignment
8. ✅ Create audit log entry

**Validation:**
- Username 3-50 chars
- Password min 8 chars
- Email valid format
- Role must exist
- Branch must exist (if provided)

#### 2.4 Reset User Password (Admin)
```http
POST /users/:id/reset-password
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  newPassword: string;    // Min 8 chars
}
```

**Business Logic:**
1. ✅ Verify user exists
2. ✅ Hash new password
3. ✅ Update password
4. ✅ **Clear all user sessions** (security)
5. ✅ Create audit log entry

**Response:**
```typescript
{
  message: 'Password reset successfully';
  messageAr: 'تم إعادة تعيين كلمة المرور بنجاح';
}
```

#### 2.5 Update User
```http
PUT /users/:id
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  fullName?: string;
  fullNameEn?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: 'ar' | 'en';
  defaultBranchId?: number;
  roleId?: number;
}
```

**Business Logic:**
1. ✅ Verify user exists
2. ✅ Validate email unique (if changed)
3. ✅ Verify role exists (if changed)
4. ✅ Verify branch exists (if changed)
5. ✅ Update user record
6. ✅ Update role assignment (if changed)
7. ✅ Create audit log entry

#### 2.6 Deactivate User
```http
DELETE /users/:id
```

**Permissions:** `admin` only

**Business Logic:**
1. ✅ Cannot delete yourself
2. ✅ Cannot delete last admin
3. ✅ Set `isActive = false`
4. ✅ Clear all sessions
5. ✅ Create audit log entry

**Response:**
```typescript
{
  message: 'User deactivated successfully';
  messageAr: 'تم إلغاء تفعيل المستخدم بنجاح';
}
```

**Error Codes:**
- `CANNOT_DELETE_SELF` - Cannot deactivate own account
- `LAST_ADMIN` - Cannot deactivate last admin

---

## Module 3: Branch Management

### Endpoints

#### 3.1 List Branches
```http
GET /branches
```

**Permissions:** `admin` only

**Response:**
```typescript
{
  branches: [
    {
      id: number;
      code: string;
      name: string;
      nameEn?: string;
      address?: string;
      phone?: string;
      isMainBranch: boolean;
      isActive: boolean;
      userCount: number;        // Count of assigned users
      createdAt: string;
    }
  ]
}
```

**Business Logic:**
- Include user count via aggregation
- Sort by: `isMainBranch DESC`, then `createdAt ASC`

#### 3.2 Create Branch
```http
POST /branches
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  code: string;           // Unique, 2-10 chars
  name: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  hasScale?: boolean;
  scaleComPort?: string;  // If hasScale = true
}
```

**Business Logic:**
1. ✅ Validate code unique
2. ✅ Set `isMainBranch = false` (only one main branch)
3. ✅ Set `isActive = true`
4. ✅ Create branch record
5. ✅ Create audit log entry

#### 3.3 Update Branch
```http
PUT /branches/:id
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  name?: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  hasScale?: boolean;
  scaleComPort?: string;
}
```

**Business Logic:**
- Cannot change `code` or `isMainBranch`
- Update only provided fields

#### 3.4 Deactivate Branch
```http
DELETE /branches/:id
```

**Permissions:** `admin` only

**Business Logic:**
1. ✅ Cannot deactivate main branch
2. ✅ Cannot deactivate last active branch
3. ✅ Set `isActive = false`
4. ✅ Create audit log entry

**Error Codes:**
- `CANNOT_DELETE_MAIN_BRANCH` - Main branch cannot be deleted
- `LAST_ACTIVE_BRANCH` - Cannot deactivate last branch

---

## Module 4: Inventory Management

### Core Concepts

**Inventory Batch (Lot) Model:**
- Each purchase creates inventory lots
- Tracked by: supplier, received date, expiry date, cost, quantity
- FIFO allocation on sales

### Endpoints

#### 4.1 List Inventory
```http
GET /inventory?branchId=1&categoryId=2&lowStock=true&expiringSoon=true
```

**Permissions:** `admin`, `cashier`

**Query Parameters:**
- `branchId` (optional): Filter by branch
- `categoryId` (optional): Filter by category
- `lowStock` (optional): Items below minimum stock
- `expiringSoon` (optional): Batches expiring within alert days

**Response:**
```typescript
{
  items: [
    {
      id: number;
      itemId: number;
      itemCode: string;
      itemName: string;
      itemNameEn?: string;
      barcode?: string;
      categoryName: string;
      branchId: number;
      branchName: string;
      totalQuantity: number;      // Sum of all lot quantities
      availableQuantity: number;  // Excluding expired/transferred
      unitOfMeasure: string;
      minStockLevel?: number;
      isLowStock: boolean;        // Computed
      batches: [
        {
          lotId: number;
          lotNumber: string;
          supplierId: number;
          supplierName: string;
          receivedAt: string;
          expiryDate?: string;
          quantity: number;
          costPerUnit: number;    // Hidden from cashier
          storageLocation?: string;
          isExpired: boolean;     // Computed
          daysUntilExpiry?: number; // Computed
        }
      ];
    }
  ]
}
```

**Business Logic:**
- **isLowStock** = `totalQuantity < minStockLevel`
- **isExpired** = `expiryDate < NOW()`
- **daysUntilExpiry** = `DAYS(expiryDate - NOW())`
- **Cashier restriction**: Hide `costPerUnit` field

#### 4.2 Get Item Details
```http
GET /inventory/items/:itemId?branchId=1
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  item: {
    id: number;
    code: string;
    name: string;
    nameEn?: string;
    barcode?: string;
    categoryId: number;
    categoryName: string;
    unitOfMeasure: string;
    minStockLevel?: number;
    sellingPrice: number;
    costPrice: number;         // Hidden from cashier
    isActive: boolean;
    inventory: {
      branchId: number;
      branchName: string;
      totalQuantity: number;
      availableQuantity: number;
      lots: [
        {
          lotNumber: string;
          supplierId: number;
          supplierName: string;
          receivedAt: string;
          expiryDate?: string;
          quantity: number;
          costPerUnit: number;  // Hidden from cashier
        }
      ];
    }[];
  }
}
```

**Business Logic:**
- Lots sorted by FIFO (oldest first)
- Aggregate inventory across branches (if admin)
- Hide cost fields from cashier

#### 4.3 Adjust Stock
```http
POST /inventory/adjust
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  branchId: number;
  itemId: number;
  adjustmentType: 'add' | 'subtract';
  quantity: number;
  reason: string;
  reference?: string;
  lotNumber?: string;       // For add
  supplierId?: number;      // For add
  expiryDate?: string;      // For add
  costPerUnit?: number;     // For add
}
```

**Business Logic:**

**For ADD adjustments:**
1. ✅ Create new inventory lot
2. ✅ Update inventory total quantity
3. ✅ Create stock movement record
4. ✅ Create audit log entry

**For SUBTRACT adjustments:**
1. ✅ Allocate from oldest lots (FIFO)
2. ✅ Update lot quantities
3. ✅ Create stock movement record
4. ✅ Create audit log entry

**Accounting Impact:**
- **Add**: DR Inventory, CR Adjustment Income
- **Subtract**: DR Loss/Shrinkage, CR Inventory

#### 4.4 Transfer Stock
```http
POST /inventory/transfer
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  fromLotId: number;        // Source lot
  toItemId: number;         // Destination product (e.g., breast from whole chicken)
  quantity: number;
  branchId: number;
  reason: string;
}
```

**Business Logic:**
1. ✅ Validate source lot has sufficient quantity
2. ✅ Deduct from source lot
3. ✅ Create new lot for destination item (inherit cost)
4. ✅ Create stock movement records (both sides)
5. ✅ Create audit log entry

**Accounting Impact:**
- Neutral (inventory to inventory, same value)

---

## Module 5: Sales & POS

### Core Business Rules

1. **FIFO Cost Allocation**: Sales deduct from oldest lots first
2. **Profit Calculation**: `Profit = Sale Price - FIFO Cost`
3. **Automatic Debt**: Credit/partial payments create debt records
4. **Discount Limits**: Cashiers limited to max discount %
5. **Stock Validation**: Cannot sell unavailable or expired stock

### Endpoints

#### 5.1 Create Sale
```http
POST /sales
```

**Permissions:** `admin`, `cashier`

**Request Body:**
```typescript
{
  branchId: number;
  customerId?: number;           // Required for credit sales
  items: [
    {
      itemId: number;
      quantity: number;
      pricePerUnit: number;
      discount: number;           // Amount, not percentage
      notes?: string;
    }
  ];
  discount: number;               // Total sale discount
  paymentMethod: 'cash' | 'bank' | 'credit' | 'partial';
  paidAmount?: number;            // Required for partial
  notes?: string;
}
```

**Response:**
```typescript
{
  sale: {
    id: number;
    saleNumber: string;         // Auto-generated: SAL-0001
    saleDate: string;
    branchId: number;
    cashierId: number;
    customerId?: number;
    customerName?: string;
    totalAmount: number;
    discount: number;
    taxAmount: number;
    netAmount: number;
    paidAmount: number;
    paymentMethod: string;
    paymentStatus: 'paid' | 'partial' | 'unpaid';
    profit: number;             // Hidden from cashier
    items: [
      {
        itemId: number;
        itemName: string;
        quantity: number;
        pricePerUnit: number;
        discount: number;
        total: number;
        costAllocations: [      // Internal, FIFO lots used
          {
            lotId: number;
            quantity: number;
            costPerUnit: number;
          }
        ];
      }
    ];
    debt?: {
      id: number;
      totalDebt: number;
      paidAmount: number;
      remainingDebt: number;
      status: 'open' | 'closed';
    };
  }
}
```

**Business Logic:**

1. **Validate Inputs**
   - ✅ Verify customer exists (if provided)
   - ✅ Verify all items exist and are active
   - ✅ Verify branch exists
   - ✅ Check cashier discount limit (if cashier role)

2. **Check Stock Availability**
   - ✅ Query inventory lots for each item (FIFO order)
   - ✅ Ensure sufficient quantity available
   - ✅ Ensure no expired lots will be used
   - ✅ Return error if insufficient stock

3. **Allocate Stock (FIFO)**
   ```typescript
   For each sale item:
     remainingQty = item.quantity
     costAllocations = []
     
     While remainingQty > 0:
       lot = getOldestAvailableLot(item.itemId, branch.id)
       if (!lot) throw INSUFFICIENT_STOCK
       
       allocatedQty = min(lot.quantity, remainingQty)
       costAllocations.push({
         lotId: lot.id,
         quantity: allocatedQty,
         costPerUnit: lot.costPerUnit
       })
       
       lot.quantity -= allocatedQty
       remainingQty -= allocatedQty
   ```

4. **Calculate Totals**
   ```typescript
   itemTotal = (quantity * pricePerUnit) - itemDiscount
   subtotal = sum(allItemTotals)
   totalAfterDiscount = subtotal - saleDiscount
   taxAmount = totalAfterDiscount * (taxRate / 10000)  // 15% = 1500 basis points
   netAmount = totalAfterDiscount + taxAmount
   
   // Calculate profit (admin only sees this)
   itemCost = sum(costAllocations.quantity * costAllocations.costPerUnit)
   totalCost = sum(allItemCosts)
   profit = netAmount - totalCost
   ```

5. **Generate Sale Number**
   ```typescript
   prefix = getSetting('numbering.sale_prefix')  // 'SAL-'
   nextNum = getSetting('numbering.sale_next')   // Auto-increment
   saleNumber = `${prefix}${nextNum.toString().padStart(4, '0')}`  // SAL-0001
   updateSetting('numbering.sale_next', nextNum + 1)
   ```

6. **Create Sale Record**
   - ✅ Insert into `sales` table
   - ✅ Insert line items into `sale_lines` table
   - ✅ Insert cost allocations into `sale_line_cost_allocations` table
   - ✅ Update inventory lot quantities

7. **Handle Payment**
   - **Cash/Bank** (fully paid):
     - `paymentStatus = 'paid'`
     - `paidAmount = netAmount`
   
   - **Credit** (no payment):
     - `paymentStatus = 'unpaid'`
     - `paidAmount = 0`
     - ✅ Create debt record
   
   - **Partial** (partial payment):
     - `paymentStatus = 'partial'`
     - `paidAmount = provided amount`
     - ✅ Create debt record for remaining

8. **Create Debt Record** (if credit/partial)
   ```typescript
   debt = {
     customerId: sale.customerId,
     saleId: sale.id,
     totalDebt: netAmount - paidAmount,
     paidAmount: 0,  // Payments tracked separately
     status: 'open',
     dueDate: addDays(now, 30)  // Default 30 days
   }
   ```

9. **Accounting Journal Entries**
   ```typescript
   // Entry 1: Record the sale
   DR: Cash/Bank/Accounts Receivable    netAmount
   CR: Sales Revenue                      totalAfterDiscount
   CR: VAT Payable                        taxAmount
   
   // Entry 2: Record cost of goods sold
   DR: Cost of Goods Sold                totalCost
   CR: Inventory                          totalCost
   ```

10. **Create Audit Log**
    - ✅ Log sale creation with all details

**Validation Rules:**
- All items must be in stock
- Discount cannot exceed item price
- Cashier discount limited by setting
- Customer required for credit/partial
- Paid amount cannot exceed net amount
- Paid amount required for partial payment

**Error Codes:**
- `INSUFFICIENT_STOCK` - Not enough inventory
- `EXPIRED_STOCK` - Would allocate from expired lot
- `INVALID_DISCOUNT` - Discount exceeds limit
- `CUSTOMER_REQUIRED` - Customer needed for credit
- `INVALID_PAYMENT` - Payment amount invalid

#### 5.2 List Sales
```http
GET /sales?page=1&branchId=1&from=2024-01-01&to=2024-12-31&paymentStatus=paid
```

**Permissions:** `admin`, `cashier`

**Query Parameters:**
- `page`, `pageSize`: Pagination
- `branchId` (optional): Filter by branch
- `customerId` (optional): Filter by customer
- `from`, `to` (optional): Date range
- `paymentStatus` (optional): `paid`, `partial`, `unpaid`

**Response:**
```typescript
{
  items: [
    {
      id: number;
      saleNumber: string;
      saleDate: string;
      customerName?: string;
      totalAmount: number;
      netAmount: number;
      paidAmount: number;
      paymentStatus: string;
      paymentMethod: string;
      profit: number;           // Hidden from cashier
      itemCount: number;
    }
  ];
  pagination: { ... };
  summary: {                   // Hidden from cashier
    totalSales: number;
    totalProfit: number;
    avgProfit: number;
  };
}
```

**Business Logic:**
- Cashier sees only their own sales (unless admin)
- Hide profit fields from cashier
- Calculate summary statistics for admin

#### 5.3 Get Sale Details
```http
GET /sales/:id
```

**Permissions:** `admin`, `cashier` (own sales only)

**Response:**
```typescript
{
  sale: {
    id: number;
    saleNumber: string;
    saleDate: string;
    branchName: string;
    cashierName: string;
    customerName?: string;
    customerPhone?: string;
    items: [
      {
        itemName: string;
        quantity: number;
        pricePerUnit: number;
        discount: number;
        total: number;
        cost: number;          // Hidden from cashier
        profit: number;        // Hidden from cashier
      }
    ];
    subtotal: number;
    discount: number;
    taxAmount: number;
    netAmount: number;
    paidAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    totalProfit: number;       // Hidden from cashier
    notes?: string;
  }
}
```

#### 5.4 Void Sale
```http
POST /sales/:id/void
```

**Permissions:** `admin` only

**Request Body:**
```typescript
{
  reason: string;            // Required
}
```

**Business Logic:**
1. ✅ Verify sale not already voided
2. ✅ Verify sale created within void window (e.g., 24 hours)
3. ✅ Restore inventory lots (reverse FIFO allocations)
4. ✅ Mark sale as void
5. ✅ If debt exists, mark as cancelled
6. ✅ Create reverse accounting entries
7. ✅ Create audit log entry

**Accounting Impact:**
```typescript
// Reverse original entries
DR: Sales Revenue                      totalAfterDiscount
DR: VAT Payable                        taxAmount
CR: Cash/Bank/Accounts Receivable     netAmount

DR: Inventory                          totalCost
CR: Cost of Goods Sold                 totalCost
```

**Error Codes:**
- `SALE_ALREADY_VOIDED` - Already voided
- `VOID_WINDOW_EXPIRED` - Too old to void
- `HAS_PAYMENTS` - Sale has received payments (cannot void)

---

## Module 6: Purchases & Suppliers

### Endpoints

#### 6.1 Create Purchase
```http
POST /purchases
```

**Permissions:** `admin`, `cashier`

**Request Body:**
```typescript
{
  branchId: number;
  supplierId: number;
  purchaseDate: string;      // ISO date
  items: [
    {
      itemId: number;
      quantity: number;
      costPerUnit: number;   // Supplier price
      lotNumber?: string;    // Auto-generated if not provided
      expiryDate?: string;   // ISO date
      storageLocation?: string;
    }
  ];
  discount: number;          // Total purchase discount
  paidAmount: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  invoiceNumber?: string;    // Supplier invoice
  notes?: string;
}
```

**Response:**
```typescript
{
  purchase: {
    id: number;
    purchaseNumber: string;   // PUR-0001
    purchaseDate: string;
    branchId: number;
    supplierId: number;
    supplierName: string;
    totalAmount: number;
    discount: number;
    netAmount: number;
    paidAmount: number;
    paymentStatus: 'paid' | 'partial' | 'unpaid';
    items: [
      {
        itemId: number;
        itemName: string;
        quantity: number;
        costPerUnit: number;
        total: number;
        lot: {
          lotNumber: string;
          expiryDate?: string;
          storageLocation?: string;
        };
      }
    ];
    debt?: {
      id: number;
      totalDebt: number;
      status: 'open';
    };
  }
}
```

**Business Logic:**

1. **Validate Inputs**
   - ✅ Verify supplier exists and is active
   - ✅ Verify all items exist and are active
   - ✅ Verify branch exists

2. **Generate Purchase Number**
   ```typescript
   prefix = getSetting('numbering.purchase_prefix')  // 'PUR-'
   nextNum = getSetting('numbering.purchase_next')
   purchaseNumber = `${prefix}${nextNum.toString().padStart(4, '0')}`
   ```

3. **Create Inventory Lots**
   ```typescript
   For each purchase item:
     lot = {
       itemId: item.itemId,
       branchId: branchId,
       supplierId: supplierId,
       purchaseId: purchase.id,
       lotNumber: item.lotNumber || generateLotNumber(),
       receivedAt: purchaseDate,
       expiryDate: item.expiryDate,
       initialQuantity: item.quantity,
       currentQuantity: item.quantity,
       costPerUnit: item.costPerUnit,
       storageLocation: item.storageLocation,
       status: 'available'
     }
     
     createLot(lot)
     updateInventoryTotal(item.itemId, branchId, +item.quantity)
   ```

4. **Calculate Totals**
   ```typescript
   subtotal = sum(items.quantity * items.costPerUnit)
   netAmount = subtotal - discount
   ```

5. **Handle Payment**
   - **Paid**: `paymentStatus = 'paid'`, no debt
   - **Partial**: `paymentStatus = 'partial'`, create debt for remaining
   - **Credit**: `paymentStatus = 'unpaid'`, create debt for full amount

6. **Create Supplier Debt** (if credit/partial)
   ```typescript
   debt = {
     supplierId: supplierId,
     purchaseId: purchase.id,
     totalDebt: netAmount - paidAmount,
     paidAmount: 0,
     status: 'open',
     dueDate: addDays(now, 30)
   }
   ```

7. **Accounting Journal Entries**
   ```typescript
   // Entry 1: Record the purchase
   DR: Inventory                         netAmount
   CR: Cash/Bank                         paidAmount
   CR: Accounts Payable                  (netAmount - paidAmount)
   ```

8. **Create Audit Log**

**Error Codes:**
- `SUPPLIER_INACTIVE` - Supplier not active
- `INVALID_ITEM` - Item doesn't exist
- `INVALID_PAYMENT` - Payment exceeds total

#### 6.2 List Purchases
```http
GET /purchases?page=1&branchId=1&supplierId=2&from=2024-01-01&to=2024-12-31
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  items: [
    {
      id: number;
      purchaseNumber: string;
      purchaseDate: string;
      supplierName: string;
      totalAmount: number;
      paidAmount: number;
      paymentStatus: string;
      itemCount: number;
    }
  ];
  pagination: { ... };
}
```

#### 6.3 Approve Purchase
```http
POST /purchases/:id/approve
```

**Permissions:** `admin` only

**Business Logic:**
- Set `approvalStatus = 'approved'`
- Set `approvedBy = currentUser.id`
- Set `approvedAt = NOW()`
- Create audit log entry

---

## Module 7: Customers & Debt Management

### Endpoints

#### 7.1 List Customers
```http
GET /customers?search=ahmad&hasDebt=true
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  customers: [
    {
      id: number;
      customerNumber: string;    // C0001
      name: string;
      nameEn?: string;
      phone?: string;
      address?: string;
      totalDebt: number;         // Sum of open debts
      totalPaid: number;         // Lifetime payments
      lastPurchaseDate?: string;
      debtStatus: 'no_debt' | 'current' | 'overdue';
      isActive: boolean;
    }
  ]
}
```

**Business Logic:**
- **totalDebt**: Sum of `debts.totalDebt - debts.paidAmount` where `status = 'open'`
- **debtStatus**:
  - `no_debt`: totalDebt = 0
  - `current`: Has debt, not overdue
  - `overdue`: Has debt past due date

#### 7.2 Get Customer Details
```http
GET /customers/:id
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  customer: {
    id: number;
    customerNumber: string;
    name: string;
    phone?: string;
    address?: string;
    totalDebt: number;
    totalPaid: number;
    debts: [
      {
        id: number;
        saleNumber: string;
        saleDate: string;
        totalDebt: number;
        paidAmount: number;
        remainingDebt: number;
        dueDate: string;
        status: 'open' | 'closed';
        isOverdue: boolean;
        daysPastDue?: number;
      }
    ];
    recentSales: [
      {
        saleNumber: string;
        saleDate: string;
        totalAmount: number;
        paymentStatus: string;
      }
    ];
    paymentHistory: [
      {
        paymentNumber: string;
        paymentDate: string;
        amount: number;
        method: string;
      }
    ];
  }
}
```

#### 7.3 Create Customer
```http
POST /customers
```

**Permissions:** `admin`, `cashier`

**Request Body:**
```typescript
{
  name: string;              // Required
  nameEn?: string;
  phone?: string;
  address?: string;
  email?: string;
  taxNumber?: string;
  creditLimit?: number;
  notes?: string;
}
```

**Business Logic:**
1. ✅ Generate customer number (C0001, C0002, etc.)
2. ✅ Validate phone unique (if provided)
3. ✅ Create customer record
4. ✅ Create audit log entry

---

## Module 8: Payments

### Endpoints

#### 8.1 Record Payment
```http
POST /payments
```

**Permissions:** `admin`, `cashier`

**Request Body:**
```typescript
{
  paymentType: 'customer_payment' | 'supplier_payment';
  partyId: number;           // Customer or Supplier ID
  amount: number;
  paymentDate: string;       // ISO date
  paymentMethod: 'cash' | 'bank' | 'cheque';
  referenceNumber?: string;  // Cheque number, bank ref, etc.
  debtIds?: number[];        // Specific debts to pay (optional)
  notes?: string;
}
```

**Response:**
```typescript
{
  payment: {
    id: number;
    paymentNumber: string;   // PAY-0001
    paymentDate: string;
    partyName: string;
    amount: number;
    paymentMethod: string;
    allocations: [           // How payment was allocated
      {
        debtId: number;
        saleNumber?: string; // If customer debt
        purchaseNumber?: string; // If supplier debt
        amountApplied: number;
        remainingDebt: number;
      }
    ];
  }
}
```

**Business Logic:**

1. **Validate Party**
   - ✅ Verify customer/supplier exists
   - ✅ Verify has open debts

2. **Allocate Payment**
   ```typescript
   If debtIds provided:
     Allocate to specified debts
   Else:
     Allocate to oldest debts first (FIFO)
   
   remainingAmount = payment.amount
   allocations = []
   
   For each debt (oldest first):
     debtRemaining = debt.totalDebt - debt.paidAmount
     amountToApply = min(remainingAmount, debtRemaining)
     
     debt.paidAmount += amountToApply
     if (debt.paidAmount >= debt.totalDebt):
       debt.status = 'closed'
     
     allocations.push({
       debtId: debt.id,
       amountApplied: amountToApply,
       remainingDebt: debt.totalDebt - debt.paidAmount
     })
     
     remainingAmount -= amountToApply
     if (remainingAmount <= 0) break
   
   If remainingAmount > 0:
     // Overpayment - create credit balance
     createCreditBalance(partyId, remainingAmount)
   ```

3. **Generate Payment Number**
   ```typescript
   prefix = getSetting('numbering.payment_prefix')  // 'PAY-'
   nextNum = getSetting('numbering.payment_next')
   paymentNumber = `${prefix}${nextNum.toString().padStart(4, '0')}`
   ```

4. **Create Payment Record**
   - ✅ Insert into `payments` table
   - ✅ Update debt records
   - ✅ Create payment allocations

5. **Accounting Journal Entries**
   ```typescript
   // Customer Payment:
   DR: Cash/Bank                         amount
   CR: Accounts Receivable               amount
   
   // Supplier Payment:
   DR: Accounts Payable                  amount
   CR: Cash/Bank                         amount
   ```

6. **Create Audit Log**

**Error Codes:**
- `NO_OPEN_DEBTS` - Party has no open debts
- `INVALID_DEBT_IDS` - Specified debts don't belong to party
- `INSUFFICIENT_DEBT` - Payment exceeds total debt

#### 8.2 List Payments
```http
GET /payments?partyType=customer&partyId=5&from=2024-01-01
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  payments: [
    {
      id: number;
      paymentNumber: string;
      paymentDate: string;
      partyName: string;
      amount: number;
      paymentMethod: string;
      debtsClosed: number;     // Count of debts fully paid
    }
  ]
}
```

---

## Module 9: Returns & Wastage

### Endpoints

#### 9.1 Create Return
```http
POST /returns
```

**Permissions:** `admin`, `cashier`

**Request Body:**
```typescript
{
  returnType: 'customer' | 'supplier';
  referenceId: number;       // Sale ID or Purchase ID
  items: [
    {
      itemId: number;
      quantity: number;
      reason: string;
      condition: 'damaged' | 'expired' | 'defective' | 'other';
    }
  ];
  refundMethod?: 'cash' | 'credit';  // For customer returns
  notes?: string;
}
```

**Business Logic:**

**Customer Return:**
1. ✅ Verify sale exists
2. ✅ Verify items were in original sale
3. ✅ Verify return quantity ≤ sold quantity
4. ✅ Calculate refund amount (original price * quantity)
5. ✅ Return items to inventory (create new lots or credited)
6. ✅ Create return record
7. ✅ If cash refund, create payment record
8. ✅ If credit refund, reduce customer debt

**Supplier Return:**
1. ✅ Verify purchase exists
2. ✅ Verify items were in original purchase
3. ✅ Identify source lot
4. ✅ Reduce lot quantity
5. ✅ Create return record
6. ✅ Increase supplier debt (we owe less)

**Accounting Impact:**
```typescript
// Customer Return (Cash):
DR: Sales Returns                      refundAmount
CR: Cash                               refundAmount
DR: Inventory                          returnCost
CR: COGS                               returnCost

// Supplier Return:
DR: Accounts Payable                   refundAmount
CR: Inventory                          refundAmount
```

#### 9.2 Record Wastage
```http
POST /wastage
```

**Permissions:** `admin`, `cashier` (record), `admin` (approve)

**Request Body:**
```typescript
{
  branchId: number;
  itemId: number;
  lotId?: number;            // Specific lot, or use FIFO
  quantity: number;
  wastageType: 'expired' | 'damaged' | 'spoiled' | 'other';
  reason: string;
  notes?: string;
}
```

**Business Logic:**
1. ✅ Verify lot exists and has sufficient quantity
2. ✅ Reduce lot quantity
3. ✅ Update inventory totals
4. ✅ Create wastage record (pending approval if cashier)
5. ✅ If admin, auto-approve

**Accounting Impact (when approved):**
```typescript
DR: Wastage/Loss Expense               costAmount
CR: Inventory                          costAmount
```

#### 9.3 Approve Wastage
```http
POST /wastage/:id/approve
```

**Permissions:** `admin` only

**Business Logic:**
- Set `approvalStatus = 'approved'`
- Set `approvedBy = currentUser.id`
- Create accounting entry
- Create audit log

---

## Module 10: Reporting

### Endpoints

#### 10.1 Sales Report
```http
GET /reports/sales?from=2024-01-01&to=2024-12-31&branchId=1&groupBy=day
```

**Permissions:** `admin`, `cashier`

**Query Parameters:**
- `from`, `to`: Date range
- `branchId` (optional): Filter by branch
- `groupBy`: `day`, `week`, `month`

**Response:**
```typescript
{
  summary: {
    totalSales: number;
    totalRevenue: number;
    totalProfit: number;       // Hidden from cashier
    avgSaleValue: number;
    transactionCount: number;
  };
  breakdown: [
    {
      period: string;          // Date or date range
      salesCount: number;
      revenue: number;
      profit: number;          // Hidden from cashier
      topItems: [
        {
          itemName: string;
          quantitySold: number;
          revenue: number;
        }
      ];
    }
  ];
}
```

#### 10.2 Profit & Loss Report
```http
GET /reports/profit-loss?from=2024-01-01&to=2024-12-31
```

**Permissions:** `admin` only

**Response:**
```typescript
{
  period: {
    from: string;
    to: string;
  };
  revenue: {
    salesRevenue: number;
    otherIncome: number;
    totalRevenue: number;
  };
  costOfGoodsSold: number;
  grossProfit: number;
  grossProfitMargin: number;   // Percentage
  expenses: {
    salaries: number;
    rent: number;
    utilities: number;
    maintenance: number;
    other: number;
    totalExpenses: number;
  };
  netProfit: number;
  netProfitMargin: number;     // Percentage
}
```

**Business Logic:**
- Query journal entries for accounts in period
- Calculate from chart of accounts structure
- Revenue accounts (4xxx)
- COGS (5100)
- Operating expenses (5200)

#### 10.3 Inventory Report
```http
GET /reports/inventory?branchId=1&categoryId=2
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  totalValue: number;          // Hidden from cashier
  itemCount: number;
  lowStockItems: number;
  expiringItems: number;
  items: [
    {
      itemName: string;
      category: string;
      branch: string;
      quantity: number;
      unitOfMeasure: string;
      costValue: number;       // Hidden from cashier
      status: 'in_stock' | 'low_stock' | 'expiring_soon';
      oldestLot?: {
        receivedDate: string;
        daysInStock: number;
      };
    }
  ];
}
```

#### 10.4 Debt Report
```http
GET /reports/debts?type=customer&status=open
```

**Permissions:** `admin`, `cashier`

**Response:**
```typescript
{
  summary: {
    totalDebt: number;
    currentDebt: number;       // Not overdue
    overdueDebt: number;
    customerCount: number;     // Or supplier count
  };
  details: [
    {
      partyName: string;
      totalDebt: number;
      paidAmount: number;
      remainingDebt: number;
      oldestDebtDate: string;
      daysPastDue: number;
      debtCount: number;
    }
  ];
}
```

---

## Module 11: Accounting

### Endpoints

#### 11.1 List Journal Entries
```http
GET /accounting/journal?from=2024-01-01&to=2024-12-31&accountCode=1110
```

**Permissions:** `admin` only

**Response:**
```typescript
{
  entries: [
    {
      id: number;
      entryNumber: string;     // JE-001
      entryDate: string;
      description: string;
      sourceType: string;      // 'sale', 'purchase', 'payment'
      sourceId: number;
      isPosted: boolean;
      lines: [
        {
          accountCode: string;
          accountName: string;
          debit: number;
          credit: number;
        }
      ];
    }
  ]
}
```

**Business Logic:**
- All journal entries are auto-generated from transactions
- Manual entries only for adjustments (admin only)

#### 11.2 Chart of Accounts
```http
GET /accounting/accounts
```

**Permissions:** `admin` only

**Response:**
```typescript
{
  accounts: [
    {
      code: string;
      name: string;
      nameEn?: string;
      accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
      parentCode?: string;
      balance: number;         // Current balance
      isSystemAccount: boolean;
    }
  ]
}
```

#### 11.3 Balance Sheet
```http
GET /accounting/balance-sheet?asOf=2024-12-31
```

**Permissions:** `admin` only

**Response:**
```typescript
{
  asOf: string;
  assets: {
    currentAssets: {
      cash: number;
      accountsReceivable: number;
      inventory: number;
      total: number;
    };
    fixedAssets: {
      equipment: number;
      furniture: number;
      total: number;
    };
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: {
      accountsPayable: number;
      vatPayable: number;
      total: number;
    };
    totalLiabilities: number;
  };
  equity: {
    capital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  balanceCheck: boolean;      // assets = liabilities + equity
}
```

---

## Cross-Cutting Concerns

### Error Handling

**Standard Error Response:**
```typescript
{
  code: string;               // ERROR_CODE
  message: string;            // English
  messageAr: string;          // Arabic
  details?: any;              // Additional context
  timestamp: string;
  path: string;              // API endpoint
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `DUPLICATE_ENTRY` - Unique constraint violation
- `INSUFFICIENT_STOCK` - Not enough inventory
- `BUSINESS_RULE_VIOLATION` - Business logic constraint

### Permissions

| Permission | Admin | Cashier |
|------------|-------|---------|
| View profits/costs | ✅ | ❌ |
| View supplier prices | ✅ | ❌ |
| Manage users | ✅ | ❌ |
| Approve purchases | ✅ | ❌ |
| Approve wastage | ✅ | ❌ |
| Void sales | ✅ | ❌ |
| View reports | ✅ | Limited |
| Record sales | ✅ | ✅ |
| Record purchases | ✅ | ✅ |
| Manage customers | ✅ | ✅ |
| Record payments | ✅ | ✅ |

### Audit Logging

**All significant actions logged:**
- User login/logout
- Sale creation/void
- Purchase creation
- Payment recording
- Password changes
- User management actions
- Settings changes

**Audit Log Entry:**
```typescript
{
  userId: number;
  username: string;
  action: string;            // 'sale_create', 'user_update', etc.
  entityType: string;        // 'Sale', 'User', etc.
  entityId: number;
  oldData?: any;             // Before state
  newData?: any;             // After state
  timestamp: string;
  ipAddress?: string;
  branchId?: number;
}
```

### Performance Considerations

**Database Indexes Required:**
- `users(currentSessionExpiry)` - Active session queries
- `sales(saleDate, branchId)` - Sales reports
- `inventory_lots(itemId, branchId, receivedAt)` - FIFO allocation
- `debts(customerId, status)` - Debt lookups
- `journal_entries(entryDate, accountCode)` - Financial reports

**Caching Strategy:**
- System settings (1 hour TTL)
- Chart of accounts (invalidate on change)
- User permissions (30 min TTL)

**Query Optimization:**
- Use pagination for all list endpoints
- Limit default page size to 20
- Max page size of 100
- Include total count for UI

---

## Summary

This comprehensive plan covers **all** backend APIs needed for the Butcher Shop POS system. Key highlights:

✅ **8 Core Modules** fully specified
✅ **FIFO inventory** allocation logic
✅ **Automatic profit calculation** on every sale
✅ **Double-entry accounting** for all transactions
✅ **Comprehensive debt management** with installments
✅ **Role-based access control** (admin vs cashier)
✅ **Full audit trail** for compliance
✅ **Bilingual support** throughout

**Next Step**: Implement each module following these specifications, starting with Authentication & Setup, then Sales/Inventory as they're the most critical.
