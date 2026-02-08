# Module 03: Branch Management

> **Status**: 🔄 Partial Implementation  
> **Priority**: P1 - High  
> **PRD Reference**: Section: Branch Management (High)

---

## Overview

This module handles:
1. **Branch CRUD** - Create, read, update, deactivate branches
2. **Main branch management** - Ensure one main branch always exists
3. **Scale configuration** - Weight scale COM port settings
4. **User-branch assignment** - Default branch per user

---

## Business Rules

1. **Main Branch**: System must always have exactly one main branch
2. **Active Branch**: At least one branch must be active
3. **Main Branch Protection**: Cannot deactivate or delete main branch
4. **User Assignment**: Users can be assigned default branches
5. **Inventory per Branch**: Inventory is tracked separately per branch

---

## Database Model

```prisma
model Branch {
  id           Int      @id @default(autoincrement())
  code         String   @unique   // 'MAIN', 'BR01', etc.
  name         String              // Arabic (primary)
  nameEn       String?  @map("name_en")
  address      String?
  phone        String?
  hasScale     Boolean  @default(true) @map("has_scale")
  scaleComPort String?  @map("scale_com_port")
  isMainBranch Boolean  @default(false) @map("is_main_branch")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relations
  users          User[]          @relation("DefaultBranch")
  inventory      Inventory[]
  inventoryLots  InventoryLot[]
  stockMovements StockMovement[]
  sales          Sale[]
  purchases      Purchase[]
  // ... other relations
}
```

---

## API Endpoints

### 3.1 List Branches

```http
GET /branches
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  branches: [
    {
      id: 1,
      code: "MAIN",
      name: "الفرع الرئيسي",
      nameEn: "Main Branch",
      address: "123 شارع الملك فيصل",
      phone: "+966501234567",
      hasScale: true,
      scaleComPort: "COM3",
      isMainBranch: true,
      isActive: true,
      userCount: 3,           // Users assigned to this branch
      createdAt: "2026-02-07T10:00:00Z"
    },
    {
      id: 2,
      code: "BR01",
      name: "فرع النخيل",
      nameEn: "Al Nakheel Branch",
      address: "456 شارع الأمير سلطان",
      phone: "+966502345678",
      hasScale: true,
      scaleComPort: "COM4",
      isMainBranch: false,
      isActive: true,
      userCount: 2,
      createdAt: "2026-02-07T11:00:00Z"
    }
  ]
}
```

#### Business Logic

```typescript
async findAll() {
  const branches = await prisma.branch.findMany({
    include: {
      _count: {
        select: { users: true }
      }
    },
    orderBy: [
      { isMainBranch: 'desc' },  // Main branch first
      { createdAt: 'asc' }
    ]
  });

  return {
    branches: branches.map(branch => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      nameEn: branch.nameEn,
      address: branch.address,
      phone: branch.phone,
      hasScale: branch.hasScale,
      scaleComPort: branch.scaleComPort,
      isMainBranch: branch.isMainBranch,
      isActive: branch.isActive,
      userCount: branch._count.users,
      createdAt: branch.createdAt.toISOString()
    }))
  };
}
```

---

### 3.2 Get Branch by ID

```http
GET /branches/:id
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  id: 1,
  code: "MAIN",
  name: "الفرع الرئيسي",
  nameEn: "Main Branch",
  address: "123 شارع الملك فيصل",
  phone: "+966501234567",
  hasScale: true,
  scaleComPort: "COM3",
  isMainBranch: true,
  isActive: true,
  userCount: 3,
  users: [
    {
      id: 1,
      username: "admin",
      fullName: "مدير النظام"
    }
  ],
  createdAt: "2026-02-07T10:00:00Z",
  updatedAt: "2026-02-08T09:00:00Z"
}
```

---

### 3.3 Create Branch

```http
POST /branches
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  code: string;           // Required, 2-10 chars, unique
  name: string;           // Required, Arabic
  nameEn?: string;        // Optional, English
  address?: string;
  phone?: string;
  hasScale?: boolean;     // Default: true
  scaleComPort?: string;  // Required if hasScale = true
}
```

#### Response (Success - 201)

```typescript
{
  id: 3,
  code: "BR02",
  name: "فرع الروضة",
  nameEn: "Al Rawdah Branch",
  address: null,
  phone: null,
  hasScale: false,
  scaleComPort: null,
  isMainBranch: false,
  isActive: true,
  userCount: 0,
  createdAt: "2026-02-08T12:00:00Z"
}
```

#### Business Logic

```typescript
async create(dto: CreateBranchDto) {
  // 1. Validate code uniqueness
  const existing = await prisma.branch.findUnique({
    where: { code: dto.code }
  });
  
  if (existing) {
    throw new ConflictException({
      code: 'DUPLICATE_ENTRY',
      message: 'Branch code already exists',
      messageAr: 'رمز الفرع موجود بالفعل'
    });
  }

  // 2. Validate scale COM port if hasScale
  if (dto.hasScale && !dto.scaleComPort) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Scale COM port is required when hasScale is true',
      messageAr: 'منفذ الميزان مطلوب عند تفعيل الميزان'
    });
  }

  // 3. Create branch (isMainBranch always false for new branches)
  const branch = await prisma.branch.create({
    data: {
      code: dto.code.toUpperCase(),
      name: dto.name,
      nameEn: dto.nameEn,
      address: dto.address,
      phone: dto.phone,
      hasScale: dto.hasScale ?? true,
      scaleComPort: dto.scaleComPort,
      isMainBranch: false,  // Main branch only set during setup
      isActive: true
    }
  });

  // 4. Create audit log
  await createAuditLog(currentUser.id, 'create', 'Branch', branch.id, {
    code: branch.code,
    name: branch.name
  });

  return toBranchResponse(branch);
}
```

#### Validation Rules

| Field | Validation |
|-------|------------|
| `code` | 2-10 chars, uppercase, alphanumeric, unique |
| `name` | Required, any string |
| `scaleComPort` | Required if `hasScale = true`, format: "COM1" - "COM99" |

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `DUPLICATE_ENTRY` | 409 | Branch code exists |
| `VALIDATION_ERROR` | 400 | Invalid input |

---

### 3.4 Update Branch

```http
PUT /branches/:id
```

**Access**: 🔒 Admin only

#### Request Body

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

**Note**: Cannot update `code` or `isMainBranch`.

#### Business Logic

```typescript
async update(id: number, dto: UpdateBranchDto) {
  const existing = await prisma.branch.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Branch not found',
      messageAr: 'الفرع غير موجود'
    });
  }

  // Cannot change code
  if (dto.code && dto.code !== existing.code) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Branch code cannot be changed',
      messageAr: 'لا يمكن تغيير رمز الفرع'
    });
  }

  // Validate scale COM port if enabling scale
  if (dto.hasScale && !dto.scaleComPort && !existing.scaleComPort) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Scale COM port is required when enabling scale',
      messageAr: 'منفذ الميزان مطلوب عند تفعيل الميزان'
    });
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      name: dto.name ?? existing.name,
      nameEn: dto.nameEn,
      address: dto.address,
      phone: dto.phone,
      hasScale: dto.hasScale ?? existing.hasScale,
      scaleComPort: dto.scaleComPort
    }
  });

  await createAuditLog(currentUser.id, 'update', 'Branch', id, {
    before: existing,
    after: branch
  });

  return toBranchResponse(branch);
}
```

---

### 3.5 Deactivate Branch

```http
DELETE /branches/:id
```

**Access**: 🔒 Admin only

#### Purpose
Soft-delete branch (set isActive = false).

#### Response (Success - 204)

No content.

#### Business Logic

```typescript
async delete(id: number) {
  const branch = await prisma.branch.findUnique({
    where: { id }
  });

  if (!branch) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Branch not found',
      messageAr: 'الفرع غير موجود'
    });
  }

  // 1. Cannot deactivate main branch
  if (branch.isMainBranch) {
    throw new ForbiddenException({
      code: 'CANNOT_DELETE_MAIN_BRANCH',
      message: 'Cannot deactivate main branch',
      messageAr: 'لا يمكن إلغاء تفعيل الفرع الرئيسي'
    });
  }

  // 2. Cannot deactivate last active branch
  const activeBranchCount = await prisma.branch.count({
    where: { isActive: true }
  });

  if (activeBranchCount <= 1) {
    throw new ForbiddenException({
      code: 'LAST_ACTIVE_BRANCH',
      message: 'Cannot deactivate the last active branch',
      messageAr: 'لا يمكن إلغاء تفعيل آخر فرع نشط'
    });
  }

  // 3. Deactivate branch
  await prisma.branch.update({
    where: { id },
    data: { isActive: false }
  });

  // 4. Create audit log
  await createAuditLog(currentUser.id, 'delete', 'Branch', id, {
    code: branch.code,
    name: branch.name
  });
}
```

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `NOT_FOUND` | 404 | Branch doesn't exist |
| `CANNOT_DELETE_MAIN_BRANCH` | 403 | Trying to delete main branch |
| `LAST_ACTIVE_BRANCH` | 403 | Last active branch |

---

### 3.6 Reactivate Branch

```http
POST /branches/:id/activate
```

**Access**: 🔒 Admin only

#### Purpose
Reactivate a previously deactivated branch.

#### Response (Success - 200)

```typescript
{
  id: 2,
  code: "BR01",
  name: "فرع النخيل",
  isActive: true,
  // ... other fields
}
```

#### Business Logic

```typescript
async activate(id: number) {
  const branch = await prisma.branch.findUnique({
    where: { id }
  });

  if (!branch) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Branch not found',
      messageAr: 'الفرع غير موجود'
    });
  }

  if (branch.isActive) {
    throw new BadRequestException({
      code: 'ALREADY_ACTIVE',
      message: 'Branch is already active',
      messageAr: 'الفرع نشط بالفعل'
    });
  }

  const updated = await prisma.branch.update({
    where: { id },
    data: { isActive: true }
  });

  await createAuditLog(currentUser.id, 'activate', 'Branch', id, {
    code: branch.code
  });

  return toBranchResponse(updated);
}
```

---

## Data Flow: Branch & Inventory

```
┌─────────────────────────────────────────────────────────────┐
│                        Branches                             │
├─────────────────────────────────────────────────────────────┤
│  MAIN Branch          │  BR01 Branch          │  BR02 Br   │
│  ─────────────        │  ─────────────        │  ─────     │
│  Inventory:           │  Inventory:           │  Invent    │
│  - Item A: 50kg       │  - Item A: 30kg       │  - Item    │
│  - Item B: 100kg      │  - Item B: 25kg       │  - Item    │
│                       │                        │            │
│  Sales tracked here   │  Sales tracked here   │  Sales     │
│  Purchases here       │  Purchases here       │  Purch     │
└─────────────────────────────────────────────────────────────┘
```

---

## Scale Integration

The branch configuration supports weight scale integration:

```typescript
{
  hasScale: true,
  scaleComPort: "COM3"
}
```

The frontend Tauri app uses this configuration to:
1. Connect to the scale via serial port
2. Read weight data in real-time
3. Auto-fill quantity fields during sales

**Supported COM Ports**: COM1 - COM99

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `GET /branches` | ✅ Implemented | branches.controller.ts |
| `GET /branches/:id` | ✅ Implemented | branches.controller.ts |
| `POST /branches` | ✅ Implemented | branches.controller.ts |
| `PUT /branches/:id` | ✅ Implemented | branches.controller.ts |
| `DELETE /branches/:id` | ✅ Implemented | branches.controller.ts |
| `POST /branches/:id/activate` | 📋 To Implement | branches.controller.ts |

---

## Future Enhancements

1. **Branch Transfer**: Transfer inventory between branches
2. **Branch Reports**: Sales/inventory reports per branch
3. **Multi-Branch User**: Users can work at multiple branches
4. **Branch Permissions**: Per-branch access control
