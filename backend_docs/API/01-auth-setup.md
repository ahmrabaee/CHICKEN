# Module 01: Authentication & Setup

> **Status**: ✅ Implemented  
> **Priority**: P0 - Critical  
> **PRD Reference**: Section 4.2.8 - Users & Authentication

---

## Overview

This module handles:
1. **First-time system setup** - Business initialization with admin account
2. **User authentication** - Login, logout, token management
3. **Session management** - Active session tracking
4. **Password management** - Change password, session invalidation

---

## Database Models

### User (Authentication Fields)

```prisma
model User {
  id                    Int       @id @default(autoincrement())
  username              String    @unique
  passwordHash          String    @map("password_hash")
  
  // Session Management
  refreshToken          String?   @map("refresh_token")
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at")
  currentSessionToken   String?   @map("current_session_token")
  currentSessionExpiry  DateTime? @map("current_session_expiry")
  lastLoginAt           DateTime? @map("last_login_at")
  
  // ...other fields
}
```

### SystemSetting

```prisma
model SystemSetting {
  id           Int      @id @default(autoincrement())
  key          String   @unique
  value        String
  dataType     String   @default("string")
  settingGroup String?  @map("setting_group")
  isSystem     Boolean  @default(false)
}
```

**Setup-related settings:**
- `setup_completed` (boolean) - Whether initial setup is done
- `business_name` (string) - Business name in Arabic
- `business_name_en` (string) - Business name in English
- `setup_completed_at` (string) - ISO timestamp of setup completion

---

## API Endpoints

### 1.1 Check Setup Status

```http
POST /auth/check-setup
```

**Access**: 🔓 Public (no authentication)

#### Purpose
Frontend calls this on app startup to determine if setup wizard should be shown.

#### Response

```typescript
// Setup not complete
{
  setupCompleted: false
}

// Setup complete
{
  setupCompleted: true,
  businessName: "محل اللحوم الطازجة",
  businessNameEn: "Fresh Meat Shop"
}
```

#### Business Logic

```typescript
async checkSetup(): Promise<CheckSetupResponse> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'setup_completed' }
  });
  
  if (!setting || setting.value !== 'true') {
    return { setupCompleted: false };
  }
  
  const businessName = await prisma.systemSetting.findUnique({
    where: { key: 'business_name' }
  });
  const businessNameEn = await prisma.systemSetting.findUnique({
    where: { key: 'business_name_en' }
  });
  
  return {
    setupCompleted: true,
    businessName: businessName?.value,
    businessNameEn: businessNameEn?.value
  };
}
```

---

### 1.2 Complete First-Time Setup

```http
POST /auth/setup
```

**Access**: 🔓 Public (one-time use only)

#### Purpose
Initialize the system with business name and create the first admin user.

#### Request Body

```typescript
{
  businessName: string;        // Required, Arabic name
  businessNameEn?: string;     // Optional, English name
  adminUsername: string;       // Min 3 chars, max 50
  adminPassword: string;       // Min 8 chars
  adminFullName: string;       // Required, Arabic
  adminFullNameEn?: string;    // Optional, English
  preferredLanguage: 'ar' | 'en';
}
```

#### Response (Success - 200)

```typescript
{
  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  expiresIn: 900,              // 15 minutes
  refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: {
    id: 1,
    username: "admin",
    fullName: "مدير النظام",
    fullNameEn: "System Admin",
    role: "admin",
    permissions: ["users:read", "users:create", ...],
    defaultBranchId: 1,
    preferredLanguage: "ar"
  }
}
```

#### Business Logic (Transaction)

```typescript
async completeSetup(dto: CompleteSetupDto, ipAddress?: string): Promise<LoginResponse> {
  // 1. Verify setup not already complete
  const setupCheck = await this.checkSetup();
  if (setupCheck.setupCompleted) {
    throw new BadRequestException({
      code: 'SETUP_ALREADY_COMPLETE',
      message: 'Initial setup has already been completed',
      messageAr: 'تم إكمال الإعداد الأولي بالفعل'
    });
  }

  return await prisma.$transaction(async (tx) => {
    // 2. Create main branch (if doesn't exist)
    let mainBranch = await tx.branch.findFirst({
      where: { isMainBranch: true }
    });
    
    if (!mainBranch) {
      mainBranch = await tx.branch.create({
        data: {
          code: 'MAIN',
          name: 'الفرع الرئيسي',
          nameEn: 'Main Branch',
          isMainBranch: true,
          isActive: true
        }
      });
    }

    // 3. Verify admin role exists (from seed)
    const adminRole = await tx.role.findUnique({
      where: { name: 'admin' }
    });
    if (!adminRole) {
      throw new BadRequestException({
        code: 'ADMIN_ROLE_NOT_FOUND',
        message: 'Admin role not found. Run database seed first.',
        messageAr: 'دور المسؤول غير موجود'
      });
    }

    // 4. Check username uniqueness
    const existingUser = await tx.user.findUnique({
      where: { username: dto.adminUsername }
    });
    if (existingUser) {
      throw new BadRequestException({
        code: 'USERNAME_EXISTS',
        message: 'Username already exists',
        messageAr: 'اسم المستخدم موجود بالفعل'
      });
    }

    // 5. Hash password (bcrypt, 12 rounds)
    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    // 6. Create admin user
    const adminUser = await tx.user.create({
      data: {
        username: dto.adminUsername,
        passwordHash,
        fullName: dto.adminFullName,
        fullNameEn: dto.adminFullNameEn,
        preferredLanguage: dto.preferredLanguage,
        defaultBranchId: mainBranch.id,
        isActive: true,
        workStartDate: new Date()
      }
    });

    // 7. Assign admin role
    await tx.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    });

    // 8. Update system settings
    await tx.systemSetting.updateMany({
      where: { key: 'setup_completed' },
      data: { value: 'true', updatedAt: new Date() }
    });
    await tx.systemSetting.updateMany({
      where: { key: 'business_name' },
      data: { value: dto.businessName, updatedAt: new Date() }
    });
    await tx.systemSetting.updateMany({
      where: { key: 'business_name_en' },
      data: { value: dto.businessNameEn || '', updatedAt: new Date() }
    });
    await tx.systemSetting.updateMany({
      where: { key: 'setup_completed_at' },
      data: { value: new Date().toISOString(), updatedAt: new Date() }
    });

    // 9. Create audit log
    await tx.auditLog.create({
      data: {
        userId: adminUser.id,
        username: adminUser.username,
        action: 'system_setup_complete',
        entityType: 'System',
        entityId: 0,
        changes: JSON.stringify({ businessName: dto.businessName }),
        ipAddress: ipAddress || 'unknown',
        userAgent: 'Setup Wizard'
      }
    });

    // 10. Auto-login (generate tokens)
    const sessionToken = randomUUID();
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 7);

    const payload = {
      sub: adminUser.id,
      username: adminUser.username,
      roles: ['admin'],
      permissions: getAdminPermissions(),
      branchId: mainBranch.id
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await tx.user.update({
      where: { id: adminUser.id },
      data: {
        refreshToken: await bcrypt.hash(refreshToken, 10),
        refreshTokenExpiresAt: sessionExpiry,
        currentSessionToken: sessionToken,
        currentSessionExpiry: sessionExpiry,
        lastLoginAt: new Date()
      }
    });

    return {
      accessToken,
      expiresIn: 900,
      refreshToken,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        fullName: adminUser.fullName,
        fullNameEn: adminUser.fullNameEn,
        role: 'admin',
        permissions: getAdminPermissions(),
        defaultBranchId: mainBranch.id,
        preferredLanguage: adminUser.preferredLanguage
      }
    };
  });
}
```

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `SETUP_ALREADY_COMPLETE` | 400 | Setup already done |
| `ADMIN_ROLE_NOT_FOUND` | 400 | Database not seeded |
| `USERNAME_EXISTS` | 400 | Username taken |
| `VALIDATION_ERROR` | 400 | Invalid input |

---

### 1.3 Login

```http
POST /auth/login
```

**Access**: 🔓 Public

#### Request Body

```typescript
{
  username: string;    // Required
  password: string;    // Required
}
```

#### Response (Success - 200)

```typescript
{
  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  expiresIn: 900,              // 15 minutes
  refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: {
    id: 1,
    username: "cashier1",
    fullName: "أحمد الكاشير",
    fullNameEn: "Ahmed Cashier",
    role: "cashier",
    permissions: ["sales:create", "sales:read", ...],
    defaultBranchId: 1,
    preferredLanguage: "ar"
  }
}
```

#### Business Logic

```typescript
async login(username: string, password: string, ipAddress?: string): Promise<LoginResponse> {
  // 1. Find user with roles
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      userRoles: {
        include: { role: true }
      }
    }
  });

  // 2. Validate credentials
  if (!user) {
    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password',
      messageAr: 'اسم المستخدم أو كلمة المرور غير صحيحة'
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password',
      messageAr: 'اسم المستخدم أو كلمة المرور غير صحيحة'
    });
  }

  // 3. Check user is active
  if (!user.isActive) {
    throw new UnauthorizedException({
      code: 'USER_INACTIVE',
      message: 'User account is inactive',
      messageAr: 'حساب المستخدم غير نشط'
    });
  }

  // 4. Collect roles and permissions
  const roles = user.userRoles.map(ur => ur.role.name);
  const permissions = collectPermissions(user.userRoles);

  // 5. Generate tokens
  const payload = {
    sub: user.id,
    username: user.username,
    roles,
    permissions,
    branchId: user.defaultBranchId
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 6. Generate session token (for tracking active sessions)
  const sessionToken = randomUUID();
  const sessionExpiry = new Date();
  sessionExpiry.setDate(sessionExpiry.getDate() + 7);

  // 7. Update user with session data
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshToken: await bcrypt.hash(refreshToken, 10),
      refreshTokenExpiresAt: sessionExpiry,
      currentSessionToken: sessionToken,
      currentSessionExpiry: sessionExpiry,
      lastLoginAt: new Date()
    }
  });

  // 8. Create audit log
  await createAuditLog(user.id, 'login', 'User', user.id, { ip: ipAddress });

  return {
    accessToken,
    expiresIn: 900,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      fullNameEn: user.fullNameEn,
      role: roles[0],
      permissions,
      defaultBranchId: user.defaultBranchId,
      preferredLanguage: user.preferredLanguage
    }
  };
}
```

#### JWT Token Structure

**Access Token (15 min expiry)**:
```typescript
{
  sub: number;           // User ID
  username: string;
  roles: string[];       // ['admin'] or ['cashier']
  permissions: string[]; // ['sales:create', 'sales:read', ...]
  branchId?: number;
  type: 'access';
  iat: number;           // Issued at
  exp: number;           // Expiration
}
```

**Refresh Token (7 day expiry)**:
```typescript
{
  sub: number;           // User ID
  type: 'refresh';
  iat: number;
  exp: number;
}
```

#### Error Codes

| Code | HTTP | Condition |
|------|------|-----------|
| `INVALID_CREDENTIALS` | 401 | Wrong username/password |
| `USER_INACTIVE` | 401 | Account deactivated |

---

### 1.4 Refresh Token

```http
POST /auth/refresh
```

**Access**: 🔓 Public (uses refresh token)

#### Request Body

```typescript
{
  refreshToken: string;    // Required
}
```

#### Response (Success - 200)

```typescript
{
  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  expiresIn: 900
}
```

#### Business Logic

```typescript
async refreshToken(refreshToken: string): Promise<RefreshResponse> {
  try {
    // 1. Verify token signature and type
    const payload = jwtService.verify(refreshToken);
    
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
        messageAr: 'رمز التحديث غير صالح'
      });
    }

    // 2. Find user and verify token hash
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: { include: { role: true } }
      }
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'User not found or token revoked',
        messageAr: 'المستخدم غير موجود أو الرمز ملغى'
      });
    }

    // 3. Compare with stored hash
    const isValidToken = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidToken) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
        messageAr: 'رمز التحديث غير صالح'
      });
    }

    // 4. Check user still active
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
        messageAr: 'حساب المستخدم غير نشط'
      });
    }

    // 5. Generate new access token
    const roles = user.userRoles.map(ur => ur.role.name);
    const permissions = collectPermissions(user.userRoles);

    const newPayload = {
      sub: user.id,
      username: user.username,
      roles,
      permissions,
      branchId: user.defaultBranchId
    };

    const accessToken = generateAccessToken(newPayload);

    return {
      accessToken,
      expiresIn: 900
    };
  } catch (error) {
    throw new UnauthorizedException({
      code: 'TOKEN_EXPIRED',
      message: 'Refresh token expired or invalid',
      messageAr: 'انتهت صلاحية رمز التحديث'
    });
  }
}
```

---

### 1.5 Logout

```http
POST /auth/logout
```

**Access**: 🔒 Authenticated

#### Response (Success - 200)

```typescript
{
  message: "Logged out successfully",
  messageAr: "تم تسجيل الخروج بنجاح"
}
```

#### Business Logic

```typescript
async logout(userId: number): Promise<void> {
  // Clear all session data
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken: null,
      refreshTokenExpiresAt: null,
      currentSessionToken: null,
      currentSessionExpiry: null
    }
  });

  // Create audit log
  await createAuditLog(userId, 'logout', 'User', userId, {});
}
```

---

### 1.6 Change Password

```http
POST /auth/change-password
```

**Access**: 🔒 Authenticated

#### Request Body

```typescript
{
  currentPassword: string;    // Required
  newPassword: string;        // Required, min 8 chars
}
```

#### Response (Success - 200)

```typescript
{
  message: "Password changed successfully",
  messageAr: "تم تغيير كلمة المرور بنجاح"
}
```

#### Business Logic

```typescript
async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  // 1. Get user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new UnauthorizedException({
      code: 'NOT_FOUND',
      message: 'User not found',
      messageAr: 'المستخدم غير موجود'
    });
  }

  // 2. Verify current password
  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new BadRequestException({
      code: 'INVALID_CREDENTIALS',
      message: 'Current password is incorrect',
      messageAr: 'كلمة المرور الحالية غير صحيحة'
    });
  }

  // 3. Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // 4. Update password AND clear all sessions (security measure)
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newPasswordHash,
      refreshToken: null,
      refreshTokenExpiresAt: null,
      currentSessionToken: null,
      currentSessionExpiry: null
    }
  });

  // 5. Create audit log
  await createAuditLog(userId, 'change_password', 'User', userId, {});
}
```

#### Security Notes

- **All sessions are invalidated** when password changes
- User must log in again after changing password
- This prevents attackers from maintaining access if they compromised an old session

---

## Helper Functions

### Generate Access Token

```typescript
function generateAccessToken(payload: JwtPayload): string {
  return jwtService.sign(
    { ...payload, type: 'access' },
    { expiresIn: '15m' }  // From env: JWT_EXPIRES_IN
  );
}
```

### Generate Refresh Token

```typescript
function generateRefreshToken(payload: JwtPayload): string {
  return jwtService.sign(
    { sub: payload.sub, type: 'refresh' },
    { expiresIn: '7d' }  // From env: JWT_REFRESH_EXPIRES_IN
  );
}
```

### Collect Permissions

```typescript
function collectPermissions(userRoles: UserRole[]): string[] {
  const permissionsSet = new Set<string>();
  
  for (const ur of userRoles) {
    if (!ur.role.permissions) continue;
    try {
      const rolePermissions = JSON.parse(ur.role.permissions) as string[];
      rolePermissions.forEach(p => permissionsSet.add(p));
    } catch {
      // Skip invalid JSON
    }
  }
  
  return Array.from(permissionsSet);
}
```

### Get Admin Permissions

```typescript
function getAdminPermissions(): string[] {
  return [
    'users:read', 'users:create', 'users:update', 'users:delete',
    'sales:read', 'sales:create', 'sales:update', 'sales:delete',
    'purchases:read', 'purchases:create', 'purchases:update',
    'inventory:read', 'inventory:create', 'inventory:update',
    'reports:read',
    'settings:read', 'settings:update',
    'branches:read', 'branches:create', 'branches:update',
    'customers:read', 'customers:create', 'customers:update',
    'debts:read', 'debts:create', 'debts:update'
  ];
}
```

---

## Validation Rules

| Field | Rules |
|-------|-------|
| `username` | 3-50 chars, alphanumeric + underscore |
| `password` | Min 8 chars |
| `businessName` | Required, any string |
| `preferredLanguage` | Must be 'ar' or 'en' |

---

## Security Considerations

1. **Password Hashing**: bcrypt with 12 rounds
2. **Token Storage**: Refresh token stored as bcrypt hash
3. **Session Tracking**: UUID session token for active session detection
4. **Forced Logout**: Password change clears all sessions
5. **IP Logging**: Login IP captured for audit trail
6. **Rate Limiting**: Should be implemented at API gateway level

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `POST /auth/check-setup` | ✅ Implemented | auth.controller.ts |
| `POST /auth/setup` | ✅ Implemented | auth.controller.ts |
| `POST /auth/login` | ✅ Implemented | auth.controller.ts |
| `POST /auth/refresh` | ✅ Implemented | auth.controller.ts |
| `POST /auth/logout` | ✅ Implemented | auth.controller.ts |
| `POST /auth/change-password` | ✅ Implemented | auth.controller.ts |
