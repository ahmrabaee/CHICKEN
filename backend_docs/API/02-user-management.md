# Module 02: User Management

> **Status**: ✅ Implemented  
> **Priority**: P0 - Critical  
> **PRD Reference**: Section 4.2.8 - Users & Authentication

---

## Overview

This module handles:
1. **User CRUD** - Create, read, update, deactivate users
2. **Role assignment** - Admin and Cashier roles
3. **Session tracking** - Active sessions, login status
4. **Admin password reset** - Reset user passwords

---

## Database Models

### User

```prisma
model User {
  id                    Int       @id @default(autoincrement())
  username              String    @unique
  email                 String?   @unique
  passwordHash          String    @map("password_hash")
  fullName              String    @map("full_name")
  fullNameEn            String?   @map("full_name_en")
  phone                 String?
  employeeNumber        String?   @unique @map("employee_number")
  preferredLanguage     String    @default("ar") @map("preferred_language")
  defaultBranchId       Int?      @map("default_branch_id")
  lastLoginAt           DateTime? @map("last_login_at")
  
  // Session Management
  refreshToken          String?   @map("refresh_token")
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at")
  currentSessionToken   String?   @map("current_session_token")
  currentSessionExpiry  DateTime? @map("current_session_expiry")
  
  // PRD Requirements
  workStartDate         DateTime  @default(now()) @map("work_start_date")
  
  isActive              Boolean   @default(true) @map("is_active")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")
  
  // Relations
  userRoles             UserRole[]
  defaultBranch         Branch?   @relation(fields: [defaultBranchId], references: [id])
}
```

### Role

```prisma
model Role {
  id           Int      @id @default(autoincrement())
  name         String   @unique  // 'admin' or 'cashier'
  nameAr       String   @map("name_ar")
  description  String?
  permissions  String?  // JSON array: ["sales.create", "sales.view", ...]
  isSystemRole Boolean  @default(false)
}
```

### UserRole (Junction)

```prisma
model UserRole {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  roleId    Int      @map("role_id")
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
  role      Role     @relation(fields: [roleId], references: [id])
  
  @@unique([userId, roleId])
}
```

---

## API Endpoints

### 2.1 List Users

```http
GET /users?page=1&pageSize=20&isActive=true&roleId=1&search=ahmad
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20, max: 100) |
| `isActive` | boolean | Filter by active status |
| `roleId` | number | Filter by role (1=admin, 2=cashier) |
| `search` | string | Search in username, fullName, email |

#### Response (Success - 200)

```typescript
{
  items: [
    {
      id: 1,
      username: "cashier1",
      fullName: "أحمد محمد",
      fullNameEn: "Ahmed Mohammed",
      email: "ahmed@example.com",
      phone: "+966501234567",
      preferredLanguage: "ar",
      defaultBranchId: 1,
      isActive: true,
      roles: ["cashier"],
      createdAt: "2026-02-07T10:30:00Z",
      lastLoginAt: "2026-02-08T08:00:00Z",
      workStartDate: "2026-02-07T10:30:00Z",  // PRD: Date added to system
      isLoggedIn: true                         // PRD: Currently logged in
    }
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 5,
    totalPages: 1
  }
}
```

#### Business Logic

```typescript
async findAll(query: UserListQueryDto, pagination: PaginationQueryDto) {
  const { page = 1, pageSize = 20 } = pagination;
  const skip = (page - 1) * pageSize;

  // Build filter conditions
  const where: any = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.roleId) {
    where.userRoles = {
      some: { roleId: query.roleId }
    };
  }

  if (query.search) {
    where.OR = [
      { username: { contains: query.search } },
      { fullName: { contains: query.search } },
      { fullNameEn: { contains: query.search } },
      { email: { contains: query.search } }
    ];
  }

  // Execute query
  const [users, totalItems] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        userRoles: { include: { role: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  // Transform to response DTOs
  const items = users.map(user => toResponseDto(user));
  
  return createPaginatedResult(items, page, pageSize, totalItems);
}

// Compute isLoggedIn status
function toResponseDto(user: any): UserResponseDto {
  const now = new Date();
  const isLoggedIn = 
    user.currentSessionToken !== null &&
    user.currentSessionExpiry !== null &&
    new Date(user.currentSessionExpiry) > now;

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    fullNameEn: user.fullNameEn,
    email: user.email,
    phone: user.phone,
    preferredLanguage: user.preferredLanguage,
    defaultBranchId: user.defaultBranchId,
    isActive: user.isActive,
    roles: user.userRoles.map(ur => ur.role.name),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
    workStartDate: user.workStartDate?.toISOString(),
    isLoggedIn
  };
}
```

---

### 2.2 Get Active Sessions

```http
GET /users/active-sessions
```

**Access**: 🔒 Admin only

#### Purpose
Get list of users currently logged in (PRD requirement for Users page).

#### Response (Success - 200)

```typescript
{
  activeCount: 2,
  users: [
    {
      userId: 1,
      username: "admin",
      fullName: "مدير النظام",
      lastLoginAt: "2026-02-08T07:00:00Z",
      sessionExpiresAt: "2026-02-15T07:00:00Z"
    },
    {
      userId: 3,
      username: "cashier1",
      fullName: "أحمد محمد",
      lastLoginAt: "2026-02-08T08:30:00Z",
      sessionExpiresAt: "2026-02-15T08:30:00Z"
    }
  ]
}
```

#### Business Logic

```typescript
async getActiveSessions() {
  const now = new Date();
  
  const activeUsers = await prisma.user.findMany({
    where: {
      currentSessionExpiry: { gt: now },
      currentSessionToken: { not: null }
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      lastLoginAt: true,
      currentSessionExpiry: true
    },
    orderBy: { lastLoginAt: 'desc' }
  });

  return {
    activeCount: activeUsers.length,
    users: activeUsers.map(user => ({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      sessionExpiresAt: user.currentSessionExpiry?.toISOString()
    }))
  };
}
```

---

### 2.3 Get User by ID

```http
GET /users/:id
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  id: 1,
  username: "cashier1",
  fullName: "أحمد محمد",
  fullNameEn: "Ahmed Mohammed",
  email: "ahmed@example.com",
  phone: "+966501234567",
  preferredLanguage: "ar",
  defaultBranchId: 1,
  isActive: true,
  roles: ["cashier"],
  createdAt: "2026-02-07T10:30:00Z",
  lastLoginAt: "2026-02-08T08:00:00Z",
  workStartDate: "2026-02-07T10:30:00Z",
  isLoggedIn: true
}
```

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `NOT_FOUND` | 404 | User doesn't exist |

---

### 2.4 Get Current User Profile

```http
GET /users/me
```

**Access**: 🔒 Any authenticated user

#### Purpose
Get profile of the currently authenticated user. Users can see their own data.

#### Response (Success - 200)

Same as Get User by ID response.

---

### 2.5 Create User

```http
POST /users
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  username: string;           // Required, 3-50 chars, unique
  password: string;           // Required, min 8 chars
  fullName: string;           // Required
  fullNameEn?: string;
  email?: string;             // Unique if provided
  phone?: string;
  preferredLanguage: 'ar' | 'en';  // Default: 'ar'
  defaultBranchId?: number;
  roleId: number;             // Required: 1=admin, 2=cashier
}
```

#### Response (Success - 201)

```typescript
{
  id: 5,
  username: "newcashier",
  fullName: "موظف جديد",
  fullNameEn: "New Employee",
  email: null,
  phone: null,
  preferredLanguage: "ar",
  defaultBranchId: 1,
  isActive: true,
  roles: ["cashier"],
  createdAt: "2026-02-08T10:00:00Z",
  lastLoginAt: null,
  workStartDate: "2026-02-08T10:00:00Z",
  isLoggedIn: false
}
```

#### Business Logic

```typescript
async create(dto: CreateUserDto): Promise<UserResponseDto> {
  // 1. Check username unique
  const existingUsername = await prisma.user.findUnique({
    where: { username: dto.username }
  });
  if (existingUsername) {
    throw new ConflictException({
      code: 'DUPLICATE_ENTRY',
      message: 'Username already exists',
      messageAr: 'اسم المستخدم موجود بالفعل'
    });
  }

  // 2. Check email unique (if provided)
  if (dto.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: dto.email }
    });
    if (existingEmail) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Email already exists',
        messageAr: 'البريد الإلكتروني موجود بالفعل'
      });
    }
  }

  // 3. Verify role exists
  const role = await prisma.role.findUnique({
    where: { id: dto.roleId }
  });
  if (!role) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Role not found',
      messageAr: 'الدور غير موجود'
    });
  }

  // 4. Verify branch exists (if provided)
  if (dto.defaultBranchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: dto.defaultBranchId }
    });
    if (!branch) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Branch not found',
        messageAr: 'الفرع غير موجود'
      });
    }
  }

  // 5. Hash password
  const passwordHash = await bcrypt.hash(dto.password, 12);

  // 6. Create user with role
  const user = await prisma.user.create({
    data: {
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      fullNameEn: dto.fullNameEn,
      email: dto.email,
      phone: dto.phone,
      preferredLanguage: dto.preferredLanguage || 'ar',
      defaultBranchId: dto.defaultBranchId,
      isActive: true,
      workStartDate: new Date(),  // PRD: Track when user was added
      userRoles: {
        create: { roleId: dto.roleId }
      }
    },
    include: {
      userRoles: { include: { role: true } }
    }
  });

  // 7. Create audit log
  await createAuditLog(currentUser.id, 'create', 'User', user.id, {
    username: user.username,
    role: role.name
  });

  return toResponseDto(user);
}
```

#### Validation Rules

| Field | Validation |
|-------|------------|
| `username` | 3-50 chars, alphanumeric + underscore, unique |
| `password` | Min 8 chars |
| `fullName` | Required, any string |
| `email` | Valid email format, unique |
| `roleId` | Must exist in roles table |
| `defaultBranchId` | Must exist in branches table |

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `DUPLICATE_ENTRY` | 409 | Username or email exists |
| `NOT_FOUND` | 404 | Role or branch not found |
| `VALIDATION_ERROR` | 400 | Invalid input |

---

### 2.6 Update User

```http
PUT /users/:id
```

**Access**: 🔒 Admin only

#### Request Body

```typescript
{
  fullName?: string;
  fullNameEn?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: 'ar' | 'en';
  defaultBranchId?: number;
  roleId?: number;
  password?: string;          // Optional: set new password
}
```

#### Business Logic

```typescript
async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
  // 1. Verify user exists
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: true }
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'User not found',
      messageAr: 'المستخدم غير موجود'
    });
  }

  // 2. Check email unique (if changing)
  if (dto.email && dto.email !== existing.email) {
    const duplicate = await prisma.user.findUnique({
      where: { email: dto.email }
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'DUPLICATE_ENTRY',
        message: 'Email already exists',
        messageAr: 'البريد الإلكتروني موجود بالفعل'
      });
    }
  }

  // 3. Build update data
  const updateData: any = {
    fullName: dto.fullName,
    fullNameEn: dto.fullNameEn,
    email: dto.email,
    phone: dto.phone,
    preferredLanguage and dto.preferredLanguage,
    defaultBranchId: dto.defaultBranchId
  };

  // 4. Hash new password if provided
  if (dto.password) {
    updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    // Clear sessions when password changes
    updateData.refreshToken = null;
    updateData.refreshTokenExpiresAt = null;
    updateData.currentSessionToken = null;
    updateData.currentSessionExpiry = null;
  }

  // 5. Update role if provided
  if (dto.roleId) {
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userRole.create({
      data: { userId: id, roleId: dto.roleId }
    });
  }

  // 6. Update user
  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      userRoles: { include: { role: true } }
    }
  });

  // 7. Create audit log
  await createAuditLog(currentUser.id, 'update', 'User', id, {
    before: existing,
    after: user
  });

  return toResponseDto(user);
}
```

---

### 2.7 Update Own Profile

```http
PUT /users/me
```

**Access**: 🔒 Any authenticated user

#### Purpose
Users can update their own profile (limited fields).

#### Request Body

```typescript
{
  fullName?: string;
  fullNameEn?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: 'ar' | 'en';
}
```

**Note**: Users cannot change their own role, username, or defaultBranchId.

---

### 2.8 Deactivate User

```http
DELETE /users/:id
```

**Access**: 🔒 Admin only

#### Purpose
Soft-delete user (set isActive = false).

#### Response (Success - 204)

No content.

#### Business Logic

```typescript
async delete(id: number, currentUserId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: { include: { role: true } }
    }
  });

  if (!user) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'User not found',
      messageAr: 'المستخدم غير موجود'
    });
  }

  // 1. Cannot delete yourself
  if (id === currentUserId) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Cannot deactivate your own account',
      messageAr: 'لا يمكنك إلغاء تفعيل حسابك الخاص'
    });
  }

  // 2. Cannot delete last admin
  const isAdmin = user.userRoles.some(ur => ur.role.name === 'admin');
  if (isAdmin) {
    const adminCount = await prisma.userRole.count({
      where: {
        role: { name: 'admin' },
        user: { isActive: true }
      }
    });

    if (adminCount <= 1) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot deactivate the last admin user',
        messageAr: 'لا يمكن إلغاء تفعيل آخر مسؤول'
      });
    }
  }

  // 3. Deactivate user and clear sessions
  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      refreshToken: null,
      refreshTokenExpiresAt: null,
      currentSessionToken: null,
      currentSessionExpiry: null
    }
  });

  // 4. Create audit log
  await createAuditLog(currentUserId, 'delete', 'User', id, {
    username: user.username
  });
}
```

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `NOT_FOUND` | 404 | User doesn't exist |
| `FORBIDDEN` | 403 | Cannot delete self or last admin |

---

### 2.9 Admin Reset Password

```http
POST /users/:id/reset-password
```

**Access**: 🔒 Admin only

#### Purpose
Admin can reset any user's password (PRD requirement).

#### Request Body

```typescript
{
  newPassword: string;    // Min 8 chars
}
```

#### Response (Success - 200)

```typescript
{
  message: "Password reset successfully",
  messageAr: "تم إعادة تعيين كلمة المرور بنجاح"
}
```

#### Business Logic

```typescript
async resetPassword(userId: number, newPassword: string): Promise<void> {
  // 1. Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'User not found',
      messageAr: 'المستخدم غير موجود'
    });
  }

  // 2. Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // 3. Update password and clear all sessions
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      refreshToken: null,
      refreshTokenExpiresAt: null,
      currentSessionToken: null,
      currentSessionExpiry: null
    }
  });

  // 4. Create audit log
  await createAuditLog(currentUser.id, 'reset_password', 'User', userId, {
    targetUsername: user.username
  });
}
```

#### Security Notes

- All user sessions are invalidated
- User must log in again with new password
- Audit trail records which admin performed the reset

---

### 2.10 Get Roles

```http
GET /users/roles
```

**Access**: 🔒 Admin only

#### Purpose
Get list of available roles for user assignment.

#### Response (Success - 200)

```typescript
[
  {
    id: 1,
    name: "admin",
    nameAr: "مدير",
    description: "Full system access"
  },
  {
    id: 2,
    name: "cashier",
    nameAr: "كاشير",
    description: "Limited access for sales operations"
  }
]
```

---

## Role Permissions

### Admin Role

```json
[
  "users:read", "users:create", "users:update", "users:delete",
  "branches:read", "branches:create", "branches:update", "branches:delete",
  "items:read", "items:create", "items:update", "items:delete",
  "inventory:read", "inventory:create", "inventory:update", "inventory:adjust",
  "sales:read", "sales:create", "sales:update", "sales:void",
  "purchases:read", "purchases:create", "purchases:update", "purchases:approve",
  "customers:read", "customers:create", "customers:update",
  "suppliers:read", "suppliers:create", "suppliers:update",
  "debts:read", "debts:create", "debts:update",
  "payments:read", "payments:create",
  "returns:read", "returns:create",
  "wastage:read", "wastage:create", "wastage:approve",
  "reports:read", "reports:export",
  "settings:read", "settings:update"
]
```

### Cashier Role

```json
[
  "sales:read", "sales:create",
  "customers:read", "customers:create",
  "debts:read",
  "payments:read", "payments:create",
  "returns:read", "returns:create",
  "inventory:read",
  "items:read"
]
```

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `GET /users` | ✅ Implemented | users.controller.ts |
| `GET /users/active-sessions` | ✅ Implemented | users.controller.ts |
| `GET /users/me` | ✅ Implemented | users.controller.ts |
| `GET /users/roles` | ✅ Implemented | users.controller.ts |
| `GET /users/:id` | ✅ Implemented | users.controller.ts |
| `POST /users` | ✅ Implemented | users.controller.ts |
| `PUT /users/me` | ✅ Implemented | users.controller.ts |
| `PUT /users/:id` | ✅ Implemented | users.controller.ts |
| `DELETE /users/:id` | ✅ Implemented | users.controller.ts |
| `POST /users/:id/reset-password` | ✅ Implemented | users.controller.ts |
