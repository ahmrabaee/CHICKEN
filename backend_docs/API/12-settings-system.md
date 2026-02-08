# Module 12: Settings & System

> **Status**: 📋 To Implement  
> **Priority**: P2 - Medium  
> **PRD Reference**: System Configuration & Preferences

---

## Overview

This module handles:
1. **Business settings** - Store information, tax rates
2. **System preferences** - Currency, date format
3. **Alert thresholds** - Low stock, expiry warnings
4. **Categories management** - Product categories
5. **Audit log** - System activity tracking
6. **Data management** - Backup, initialization

---

## Settings Categories

```
┌──────────────────────────────────────────────────────────────┐
│                     SETTINGS DASHBOARD                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  BUSINESS                     INVENTORY                      │
│  ├─ Store Name               ├─ Low Stock Threshold         │
│  ├─ Address                  ├─ Expiry Alert Days           │
│  ├─ Phone                    └─ Auto-generate Lot Numbers   │
│  ├─ VAT Number                                              │
│  └─ Logo                     SALES                          │
│                              ├─ Default Credit Days         │
│  REGIONAL                    ├─ Allow Price Override        │
│  ├─ Currency                 ├─ Require Customer for Credit │
│  ├─ Decimal Places           └─ Print Invoice Automatically │
│  ├─ Date Format                                              │
│  └─ Language                 INVOICE                         │
│                              ├─ Invoice Prefix               │
│  SCALE INTEGRATION           ├─ Footer Text                  │
│  ├─ Serial Port              └─ Show Store Logo              │
│  ├─ Baud Rate                                                │
│  └─ Data Format                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Models

### Setting

```prisma
model Setting {
  id              Int       @id @default(autoincrement())
  key             String    @unique
  value           String
  dataType        String    @map("data_type")  // 'string', 'number', 'boolean', 'json'
  category        String                       // 'business', 'inventory', 'sales', etc.
  description     String?
  descriptionAr   String?   @map("description_ar")
  isPublic        Boolean   @default(false) @map("is_public")  // Visible to all users
  
  updatedAt       DateTime  @updatedAt
  updatedBy       Int?      @map("updated_by")
}
```

### Category

```prisma
model Category {
  id              Int       @id @default(autoincrement())
  code            String    @unique
  name            String
  nameEn          String?   @map("name_en")
  parentId        Int?      @map("parent_id")
  sortOrder       Int       @default(0) @map("sort_order")
  isActive        Boolean   @default(true)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  parent          Category? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children        Category[] @relation("CategoryHierarchy")
  items           Item[]
}
```

### AuditLog

```prisma
model AuditLog {
  id              Int       @id @default(autoincrement())
  userId          Int?      @map("user_id")
  action          String                       // 'create', 'update', 'delete', 'login', etc.
  entityType      String    @map("entity_type") // 'Sale', 'User', 'Setting', etc.
  entityId        Int?      @map("entity_id")
  
  oldValues       String?   @map("old_values")  // JSON
  newValues       String?   @map("new_values")  // JSON
  
  ipAddress       String?   @map("ip_address")
  userAgent       String?   @map("user_agent")
  
  timestamp       DateTime  @default(now())

  // Relations
  user            User?     @relation(fields: [userId], references: [id])
}
```

---

## Default Settings

| Key | Default | Description |
|-----|---------|-------------|
| `business.name` | "" | Store name |
| `business.name_en` | "" | Store name (English) |
| `business.address` | "" | Store address |
| `business.phone` | "" | Store phone |
| `business.vat_number` | "" | VAT registration number |
| `regional.currency` | "SAR" | Currency code |
| `regional.currency_symbol` | "ر.س" | Currency symbol |
| `regional.decimal_places` | 3 | Decimal places for amounts |
| `regional.date_format` | "YYYY-MM-DD" | Date display format |
| `regional.language` | "ar" | Default language |
| `inventory.low_stock_threshold` | 10 | Default low stock alert |
| `inventory.expiry_alert_days` | 7 | Days before expiry to alert |
| `inventory.auto_lot_numbers` | true | Auto-generate lot numbers |
| `sales.default_credit_days` | 7 | Default days for credit |
| `sales.allow_price_override` | true | Allow cashiers to change prices |
| `sales.require_customer_credit` | true | Require customer for credit sales |
| `invoice.prefix` | "SAL-" | Invoice number prefix |
| `invoice.footer` | "شكراً لزيارتكم" | Invoice footer text |
| `invoice.show_logo` | true | Show logo on invoice |

---

## API Endpoints

### 12.1 Get All Settings

```http
GET /settings
```

**Access**: 🔒 Admin only (full), Cashier (public only)

#### Response (Success - 200)

```typescript
{
  settings: {
    business: {
      name: "مطعم الدجاج الذهبي",
      name_en: "Golden Chicken Restaurant",
      address: "شارع الملك فهد، الرياض",
      phone: "0112345678",
      vat_number: "300123456789003"
    },
    regional: {
      currency: "SAR",
      currency_symbol: "ر.س",
      decimal_places: 3,
      date_format: "YYYY-MM-DD",
      language: "ar"
    },
    inventory: {
      low_stock_threshold: 10,
      expiry_alert_days: 7,
      auto_lot_numbers: true
    },
    sales: {
      default_credit_days: 7,
      allow_price_override: true,
      require_customer_credit: true
    },
    invoice: {
      prefix: "SAL-",
      footer: "شكراً لزيارتكم",
      show_logo: true
    },
    scale: {
      enabled: false,
      port: "COM1",
      baud_rate: 9600,
      data_format: "standard"
    }
  }
}
```

---

### 12.2 Update Settings

```http
PUT /settings
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  settings: {
    "business.name": "اسم المتجر الجديد",
    "inventory.low_stock_threshold": 15,
    "sales.default_credit_days": 14
  }
}
```

#### Response (Success - 200)

```typescript
{
  updated: [
    { key: "business.name", value: "اسم المتجر الجديد" },
    { key: "inventory.low_stock_threshold", value: 15 },
    { key: "sales.default_credit_days", value: 14 }
  ],
  message: "Settings updated successfully",
  messageAr: "تم تحديث الإعدادات بنجاح"
}
```

#### Business Logic

```typescript
async updateSettings(dto: UpdateSettingsDto, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const updated = [];
    
    for (const [key, value] of Object.entries(dto.settings)) {
      const setting = await tx.setting.findUnique({
        where: { key }
      });
      
      if (!setting) {
        throw new BadRequestException({
          code: 'INVALID_SETTING',
          message: `Unknown setting: ${key}`,
          messageAr: `إعداد غير معروف: ${key}`
        });
      }
      
      // Validate value type
      const validValue = validateSettingValue(setting.dataType, value);
      
      // Get old value for audit
      const oldValue = setting.value;
      
      await tx.setting.update({
        where: { key },
        data: {
          value: String(validValue),
          updatedBy: userId
        }
      });
      
      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'update',
          entityType: 'Setting',
          entityId: setting.id,
          oldValues: JSON.stringify({ [key]: oldValue }),
          newValues: JSON.stringify({ [key]: validValue })
        }
      });
      
      updated.push({ key, value: validValue });
    }
    
    return { updated };
  });
}
```

---

### 12.3 List Categories

```http
GET /categories?active=true
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  categories: [
    {
      id: 1,
      code: "POULTRY",
      name: "دواجن",
      nameEn: "Poultry",
      parentId: null,
      sortOrder: 1,
      isActive: true,
      itemCount: 8,
      children: [
        {
          id: 5,
          code: "POULTRY-FRESH",
          name: "دواجن طازجة",
          nameEn: "Fresh Poultry",
          parentId: 1,
          sortOrder: 1,
          isActive: true,
          itemCount: 5
        }
      ]
    },
    {
      id: 2,
      code: "MEAT",
      name: "لحوم",
      nameEn: "Meat",
      parentId: null,
      sortOrder: 2,
      isActive: true,
      itemCount: 5,
      children: []
    }
  ],
  totalCategories: 10,
  totalActiveItems: 25
}
```

---

### 12.4 Create Category

```http
POST /categories
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  code?: string;              // Auto-generated if not provided
  name: string;               // Arabic name
  nameEn?: string;            // English name
  parentId?: number;          // For subcategories
  sortOrder?: number;
}
```

#### Response (Success - 201)

```typescript
{
  category: {
    id: 10,
    code: "SEAFOOD",
    name: "مأكولات بحرية",
    nameEn: "Seafood",
    parentId: null,
    sortOrder: 4,
    isActive: true
  },
  message: "Category created successfully",
  messageAr: "تم إنشاء الفئة بنجاح"
}
```

---

### 12.5 Update Category

```http
PUT /categories/:id
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  name?: string;
  nameEn?: string;
  parentId?: number;
  sortOrder?: number;
}
```

---

### 12.6 Delete Category

```http
DELETE /categories/:id
```

**Access**: 🔒 Admin only

#### Business Logic

```typescript
async deleteCategory(categoryId: number) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      items: { take: 1 },
      children: { take: 1 }
    }
  });

  if (!category) {
    throw new NotFoundException('Category not found');
  }

  if (category.items.length > 0) {
    throw new BadRequestException({
      code: 'HAS_ITEMS',
      message: 'Cannot delete category with items',
      messageAr: 'لا يمكن حذف فئة تحتوي على منتجات'
    });
  }

  if (category.children.length > 0) {
    throw new BadRequestException({
      code: 'HAS_CHILDREN',
      message: 'Cannot delete category with subcategories',
      messageAr: 'لا يمكن حذف فئة تحتوي على فئات فرعية'
    });
  }

  await prisma.category.delete({
    where: { id: categoryId }
  });

  return { message: 'Category deleted successfully' };
}
```

---

### 12.7 Get Audit Log

```http
GET /audit-log?userId=1&action=update&entityType=Setting&from=2026-02-01
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | number | Filter by user |
| `action` | string | 'create', 'update', 'delete', 'login', etc. |
| `entityType` | string | 'Sale', 'User', 'Setting', etc. |
| `entityId` | number | Filter by specific entity |
| `from` | date | Start date |
| `to` | date | End date |

#### Response (Success - 200)

```typescript
{
  logs: [
    {
      id: 500,
      userId: 1,
      userName: "admin",
      action: "update",
      entityType: "Setting",
      entityId: 15,
      
      oldValues: {
        "business.name": "المتجر القديم"
      },
      newValues: {
        "business.name": "المتجر الجديد"
      },
      
      ipAddress: "192.168.1.100",
      timestamp: "2026-02-08T15:30:00Z"
    },
    {
      id: 499,
      userId: 3,
      userName: "cashier1",
      action: "create",
      entityType: "Sale",
      entityId: 42,
      
      oldValues: null,
      newValues: {
        invoiceNumber: "SAL-0042",
        totalAmount: 40000
      },
      
      ipAddress: "192.168.1.101",
      timestamp: "2026-02-08T14:30:00Z"
    }
  ],
  
  summary: {
    totalActions: 1500,
    byAction: {
      create: 800,
      update: 500,
      delete: 50,
      login: 150
    }
  },
  
  pagination: { ... }
}
```

---

### 12.8 Get System Status

```http
GET /system/status
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  system: {
    version: "1.0.0",
    environment: "production",
    startedAt: "2026-02-01T00:00:00Z",
    uptime: "7d 15h 30m"
  },
  
  database: {
    status: "connected",
    size: "256 MB",
    lastBackup: "2026-02-08T00:00:00Z"
  },
  
  stats: {
    totalUsers: 5,
    activeUsers: 3,
    totalSales: 450,
    totalCustomers: 50,
    totalItems: 25,
    totalInventoryValue: 750000
  },
  
  alerts: [
    {
      type: "low_stock",
      count: 3,
      message: "3 items below minimum stock level"
    },
    {
      type: "expiring_soon",
      count: 5,
      message: "5 lots expiring within 7 days"
    },
    {
      type: "overdue_debts",
      count: 2,
      message: "2 debts are overdue"
    }
  ]
}
```

---

### 12.9 Create Backup

```http
POST /system/backup
```

**Access**: 🔒 Admin only

#### Response (Success - 201)

```typescript
{
  backup: {
    id: "backup-20260208-153000",
    filename: "backup-20260208-153000.db",
    size: "256 MB",
    createdAt: "2026-02-08T15:30:00Z"
  },
  message: "Backup created successfully",
  messageAr: "تم إنشاء النسخة الاحتياطية بنجاح"
}
```

---

### 12.10 Initialize System (First-Time Setup)

```http
POST /system/initialize
```

**Access**: 🔓 Public (only when no admin exists)

#### Request Body

```typescript
{
  businessName: string;
  businessNameEn?: string;
  adminUsername: string;
  adminPassword: string;
  adminEmail?: string;
  
  createSampleData?: boolean;  // Create sample categories/items
}
```

#### Response (Success - 201)

See Module 01 (Auth & Setup) for details.

---

### 12.11 Scale Integration Settings

```http
PUT /settings/scale
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  enabled: boolean;
  port: string;               // "COM1", "COM2", etc.
  baudRate: number;           // 9600, 19200, etc.
  dataBits: number;           // 7, 8
  stopBits: number;           // 1, 2
  parity: 'none' | 'even' | 'odd';
  dataFormat: 'standard' | 'custom';
  customFormat?: string;      // Regex pattern
}
```

#### Response (Success - 200)

```typescript
{
  scale: {
    enabled: true,
    port: "COM1",
    baudRate: 9600,
    connected: true,            // Current status
    lastReading: "15.500"       // Last weight reading
  },
  message: "Scale settings updated",
  messageAr: "تم تحديث إعدادات الميزان"
}
```

---

### 12.12 Test Scale Connection

```http
POST /settings/scale/test
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  connected: true,
  reading: "15.500",
  unit: "kg",
  message: "Scale connected successfully",
  messageAr: "تم الاتصال بالميزان بنجاح"
}
```

---

## Error Codes

| Code | HTTP | Message (EN) | Message (AR) |
|------|------|--------------|--------------|
| `INVALID_SETTING` | 400 | Unknown setting key | إعداد غير معروف |
| `INVALID_VALUE` | 400 | Invalid setting value | قيمة الإعداد غير صالحة |
| `CATEGORY_NOT_FOUND` | 404 | Category not found | الفئة غير موجودة |
| `HAS_ITEMS` | 400 | Category has items | الفئة تحتوي على منتجات |
| `HAS_CHILDREN` | 400 | Category has subcategories | الفئة تحتوي على فئات فرعية |
| `SCALE_NOT_CONNECTED` | 500 | Scale not connected | الميزان غير متصل |
| `BACKUP_FAILED` | 500 | Backup failed | فشل إنشاء النسخة الاحتياطية |

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `GET /settings` | 📋 To Implement | settings.controller.ts |
| `PUT /settings` | 📋 To Implement | settings.controller.ts |
| `GET /categories` | 📋 To Implement | categories.controller.ts |
| `POST /categories` | 📋 To Implement | categories.controller.ts |
| `PUT /categories/:id` | 📋 To Implement | categories.controller.ts |
| `DELETE /categories/:id` | 📋 To Implement | categories.controller.ts |
| `GET /audit-log` | 📋 To Implement | audit.controller.ts |
| `GET /system/status` | 📋 To Implement | system.controller.ts |
| `POST /system/backup` | 📋 To Implement | system.controller.ts |
| `POST /system/initialize` | 📋 To Implement | system.controller.ts |
| `PUT /settings/scale` | 📋 To Implement | settings.controller.ts |
| `POST /settings/scale/test` | 📋 To Implement | settings.controller.ts |
