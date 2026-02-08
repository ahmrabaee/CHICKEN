# Database Schema and API Rebuild Implementation Plan

## Goal Description

This implementation plan addresses the requirements specified in the PRD for the Butcher Shop Accounting & POS System. The plan focuses on:

1. **First-Time Setup Flow**: Implementing initial system setup that collects business name and admin credentials
2. **Enhanced User Management**: Adding comprehensive user tracking including login status, last appearance, work start date, and branch assignment
3. **Users Page Requirements**: Creating APIs to support detailed user listing with all PRD-specified fields
4. **Authentication Security**: Ensuring robust authentication with proper error handling and role-based access control
5. **Multi-language Support**: Implementing Arabic/English language preferences throughout the system

## Current System Analysis

### Existing Strengths
- ✅ **Robust Database Schema**: Comprehensive Prisma schema with 850+ lines covering all business entities
- ✅ **Authentication System**: JWT-based auth with access/refresh tokens, bcrypt password hashing
- ✅ **Role-Based Access Control**: Admin and cashier roles with permissions system
- ✅ **User Management APIs**: CRUD operations for users with profile management
- ✅ **Audit Logging**: Comprehensive audit trail for all actions
- ✅ **Bilingual Support**: Arabic and English field names throughout

### Gaps Identified

1. **Missing First-Time Setup Flow**
   - No initial setup wizard for business name and admin account creation
   - No system setting table entries for business configuration

2. **Incomplete User Tracking**
   - Missing "currently logged in" status tracking
   - No "work start date" field (using `createdAt` as workaround)
   - No explicit "manager" role (only admin and cashier exist)

3. **Missing Setup Endpoints**
   - No `/auth/setup` endpoint for first-time initialization
   - No `/auth/check-setup` endpoint to verify if setup is complete

4. **Branch Management Limitation**
   - PRD states "branches cannot be added" but schema supports multi-branch
   - Need to enforce single main branch policy

## User Review Required

> [!NOTE]
> **Role System Confirmed**
> 
> The system uses two roles only:
> - `admin` - Full access to all features
> - `cashier` - Limited access (cannot view profits, supplier prices, expenses)
> 
> No additional roles are needed.

---

## Proposed Changes

### Database Schema Updates

#### 1. [MODIFY] User Model

**File**: [schema.prisma](file:///f:/Projects/Generl/Financial%20Management%20Program/app/backend/prisma/schema.prisma#L76-L130)

Add new fields to support PRD requirements:

```prisma
model User {
  // ... existing fields ...
  
  // NEW: Work start date for tracking when user was added
  workStartDate    DateTime  @default(now()) @map("work_start_date")
  
  // NEW: Current login session tracking
  currentSessionToken String?   @map("current_session_token")
  currentSessionExpiry DateTime? @map("current_session_expiry")
  
  // ... rest of model ...
}
```

**Rationale**: 
- `workStartDate` tracks when the user was added to the system (PRD requirement)
- Session tracking allows us to determine if user is currently logged in

#### 2. [MODIFY] SystemSetting Model

**File**: [schema.prisma](file:///f:/Projects/Generl/Financial%20Management%20Program/app/backend/prisma/schema.prisma#L802-L814)

Add initial setup tracking settings:

```prisma
// Seed data to add:
// - setup_completed: boolean
// - business_name: string
// - business_name_en: string
// - setup_completed_at: ISO datetime
```

**Rationale**: Track system initialization status for first-time setup flow

#### 3. Role System

**Confirmed**: System uses only two roles:
- `admin` - Full system access
- `cashier` - Limited access (no profit/supplier price visibility)

**Implementation**: No changes needed to role schema

#### 4. Branch Management

**Implementation**: 
- Keep full multi-branch support (already implemented in schema)
- Auto-create one main branch during first-time setup
- Allow admins to create, edit, and manage additional branches via API
- Enforce at least one active branch at all times
- Support cross-branch inventory transfers and reporting

---

## Proposed API Changes

### Component: Authentication & Setup

#### [NEW] POST `/auth/check-setup`

**Purpose**: Check if initial setup has been completed

**Request**: None (public endpoint)

**Response**:
```typescript
{
  setupCompleted: boolean;
  businessName?: string;
  businessNameEn?: string;
}
```

**Logic**:
- Query `SystemSetting` table for `setup_completed` key
- Return setup status

#### [NEW] POST `/auth/setup`

**Purpose**: Complete first-time system setup

**Request**:
```typescript
{
  businessName: string;
  businessNameEn?: string;
  adminUsername: string;
  adminPassword: string;
  adminFullName: string;
  preferredLanguage: "ar" | "en";
}
```

**Response**:
```typescript
{
  message: string;
  messageAr: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}
```

**Logic**:
1. Check if setup already completed → throw error if yes
2. Create transaction:
   - Create main branch (code: "MAIN", isMainBranch: true)
   - Create admin user with hashed password
   - Assign admin role to user
   - Set system settings (setup_completed, business_name)
   - Create audit log
3. Generate JWT tokens
4. Return login response

**Error Handling**:
- `409 CONFLICT`: Setup already completed
- `400 BAD_REQUEST`: Validation errors
- `500 INTERNAL_ERROR`: Database transaction failed

#### [MODIFY] POST `/auth/login`

**File**: [auth.controller.ts](file:///f:/Projects/Generl/Financial%20Management%20Program/app/backend/src/auth/auth.controller.ts#L30-L48)

**Changes**:
- Add session token generation
- Update `currentSessionToken` and `currentSessionExpiry` in User table
- Store session token expiry (matches refresh token expiry: 7 days)

**Enhanced Response**: Same as current

#### [MODIFY] POST `/auth/logout`

**File**: [auth.controller.ts](file:///f:/Projects/Generl/Financial%20Management%20Program/app/backend/src/auth/auth.controller.ts#L70-L88)

**Changes**:
- Clear `currentSessionToken` and `currentSessionExpiry` on logout
- Clear `refreshToken` (already implemented)

#### [NEW] GET `/auth/password-reset-policy`

**Purpose**: Return password policy for non-admin users trying to change password

**Request**: None (public endpoint)

**Response**:
```typescript
{
  message: "Password changes must be requested through an administrator",
  messageAr: "يجب طلب تغيير كلمة المرور من خلال المسؤول",
  requiresAdmin: true
}
```

---

### Component: User Management

#### [MODIFY] GET `/users`

**File**: [users.controller.ts](file:///f:/Projects/Generl/Financial%20Management%20Program/app/backend/src/users/users.controller.ts#L43-L59)

**Current Implementation**: ✅ Already exists

**Enhancement Needed**: Add computed fields to response

**Enhanced Response**:
```typescript
{
  data: [
    {
      id: number;
      fullName: string;
      username: string;
      role: string; // "admin" | "cashier"
      defaultBranchId: number;
      defaultBranchName: string; // NEW: Include branch name
      isActive: boolean; // status: active/inactive
      lastLoginAt: DateTime | null; // Last appearance
      isLoggedIn: boolean; // NEW: Computed from session token expiry
      workStartDate: DateTime; // NEW: Date added to system
      preferredLanguage: string;
      createdAt: DateTime;
    }
  ],
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  }
}
```

**Logic Changes**:
- Join with `Branch` table to get branch name
- Compute `isLoggedIn` from `currentSessionExpiry > NOW()`
- Return `workStartDate` field
- Add filters for: `role`, `isActive`, `isLoggedIn`, `branchId`

#### [MODIFY] POST `/users`

**File**: [users.controller.ts](file:///f:/Projects/Generl/Financial%20Management%20Program/app/backend/src/users/users.controller.ts#L107-L125)

**Current Implementation**: ✅ Already exists

**Enhancement Needed**: Validate role and branch assignments

**Enhanced Request Validation**:
```typescript
{
  fullName: string; // Required
  username: string; // Required
  password: string; // Required, min 8 chars
  role: "admin" | "cashier"; // Required
  defaultBranchId?: number; // Optional, auto-set to main branch if null
  preferredLanguage: "ar" | "en"; // Required
  fullNameEn?: string;
  email?: string;
  phone?: string;
}
```

**Logic Changes**:
- If `defaultBranchId` not provided, auto-assign to main branch
- If `defaultBranchId` provided, validate that branch exists and is active
- Set `workStartDate` to current timestamp
- Validate that role exists in database
- Hash password with bcrypt (rounds: 12)

#### [NEW] GET `/users/active-sessions`

**Purpose**: Get count and list of currently logged-in users (admin only)

**Request**: None

**Response**:
```typescript
{
  activeCount: number;
  users: [
    {
      id: number;
      fullName: string;
      username: string;
      lastLoginAt: DateTime;
      sessionExpiresAt: DateTime;
    }
  ]
}
```

**Logic**:
- Filter users where `currentSessionExpiry > NOW()`
- Order by `lastLoginAt DESC`

#### [NEW] POST `/users/:id/reset-password`

**Purpose**: Admin endpoint to reset a user's password

**Request**:
```typescript
{
  newPassword: string; // Min 8 chars
}
```

**Response**:
```typescript
{
  message: "Password reset successfully",
  messageAr: "تم إعادة تعيين كلمة المرور بنجاح"
}
```

**Logic**:
- Verify requester has admin role
- Hash new password
- Update user password
- Clear all sessions (refreshToken + currentSessionToken)
- Create audit log

---

### Component: Branch Management

#### [NEW] GET `/branches`

**Purpose**: List all branches (admin only)

**Request**: None

**Response**:
```typescript
{
  data: [
    {
      id: number;
      code: string;
      name: string;
      nameEn?: string;
      address?: string;
      phone?: string;
      isMainBranch: boolean;
      isActive: boolean;
      userCount: number; // Count of users assigned to this branch
      createdAt: DateTime;
    }
  ]
}
```

#### [NEW] POST `/branches`

**Purpose**: Create new branch (admin only)

**Request**:
```typescript
{
  code: string; // Unique branch code
  name: string; // Arabic name
  nameEn?: string;
  address?: string;
  phone?: string;
  hasScale?: boolean;
  scaleComPort?: string;
}
```

**Response**: Created branch object

**Logic**:
- Validate unique branch code
- Create branch with `isMainBranch = false`
- Create audit log

#### [NEW] PUT `/branches/:id`

**Purpose**: Update branch information (admin only)

**Request**: Same as POST (without code)

**Response**: Updated branch object

#### [NEW] DELETE `/branches/:id`

**Purpose**: Deactivate branch (admin only)

**Logic**:
- Cannot delete main branch
- Cannot delete last active branch
- Set `isActive = false` instead of hard delete
- Check if any users are assigned (warn/reassign)

---

### Component: Settings

#### [NEW] GET `/settings/business-info`

**Purpose**: Get business information (public after setup)

**Response**:
```typescript
{
  businessName: string;
  businessNameEn?: string;
  mainBranch: {
    id: number;
    name: string;
    address?: string;
    phone?: string;
  }
}
```

#### [NEW] PUT `/settings/business-info`

**Purpose**: Update business information (admin only)

**Request**:
```typescript
{
  businessName: string;
  businessNameEn?: string;
}
```

---

## Technical Implementation Details

### Authentication Flow Enhancements

#### Current Flow
1. User logs in with username/password
2. System validates credentials
3. System generates access token (15min) and refresh token (7d)
4. System stores hashed refresh token in database
5. Returns tokens + user info

#### Enhanced Flow (with session tracking)
1. User logs in with username/password
2. System validates credentials
3. System generates:
   - Access token (15min)
   - Refresh token (7d)
   - Session token (UUID v4)
4. System stores in database:
   - Hashed refresh token in `refreshToken`
   - Session token in `currentSessionToken`
   - Session expiry (7d from now) in `currentSessionExpiry`
   - Last login timestamp in `lastLoginAt`
5. Returns tokens + user info

#### Session Validation
```typescript
// Check if user is logged in
function isUserLoggedIn(user: User): boolean {
  if (!user.currentSessionExpiry) return false;
  return user.currentSessionExpiry > new Date();
}
```

### Error Handling Strategy

#### Consistent Error Response Format
```typescript
{
  code: string; // Machine-readable error code
  message: string; // English error message
  messageAr: string; // Arabic error message
  details?: any; // Optional validation details
}
```

#### Standard Error Codes
- `INVALID_CREDENTIALS`: Wrong username/password
- `USER_INACTIVE`: Account disabled
- `USER_NOT_FOUND`: User doesn't exist
- `PERMISSION_DENIED`: Insufficient permissions
- `SETUP_ALREADY_COMPLETE`: Cannot run setup twice
- `SETUP_NOT_COMPLETE`: Must complete setup first
- `VALIDATION_ERROR`: Input validation failed
- `DUPLICATE_USERNAME`: Username already exists
- `TOKEN_EXPIRED`: JWT token expired
- `TOKEN_INVALID`: JWT token malformed
- `SESSION_EXPIRED`: User session expired
- `PASSWORD_TOO_WEAK`: Password doesn't meet requirements

### Migration Strategy

#### Migration Files to Create

**1. Add User Fields Migration**
```sql
-- 20260208_add_user_tracking_fields.sql
ALTER TABLE users ADD COLUMN work_start_date DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN current_session_token TEXT;
ALTER TABLE users ADD COLUMN current_session_expiry DATETIME;

-- Backfill work_start_date with created_at for existing users
UPDATE users SET work_start_date = created_at WHERE work_start_date IS NULL;
```

**2. Add System Settings Migration**
```sql
-- 20260208_add_system_settings.sql
INSERT INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('setup_completed', 'false', 'Whether initial system setup is complete', 'boolean', 'system', true),
('business_name', '', 'Business name in Arabic', 'string', 'business', true),
('business_name_en', '', 'Business name in English', 'string', 'business', true),
('setup_completed_at', '', 'Timestamp when setup was completed', 'string', 'system', true);
```



### Database Indexes to Add

```sql
-- Improve session lookup performance
CREATE INDEX idx_users_session_expiry ON users(current_session_expiry) WHERE current_session_expiry IS NOT NULL;

-- Improve user listing performance
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_work_start_date ON users(work_start_date);
```

---

## Verification Plan

### Automated Tests

#### Unit Tests
- `auth.service.spec.ts`: Test first-time setup logic
- `auth.service.spec.ts`: Test session token generation/validation
- `users.service.spec.ts`: Test user creation with PRD requirements
- `users.service.spec.ts`: Test `isLoggedIn` computed field logic

#### Integration Tests
```typescript
describe('First-Time Setup Flow', () => {
  it('should allow setup when not completed', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/setup')
      .send({
        businessName: 'متجر الدجاج',
        businessNameEn: 'Chicken Shop',
        adminUsername: 'admin',
        adminPassword: 'SecurePass123!',
        adminFullName: 'أحمد محمد',
        preferredLanguage: 'ar'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user.role).toBe('admin');
  });

  it('should prevent duplicate setup', async () => {
    // Run setup twice
    await setupSystem();
    const response = await setupSystem();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SETUP_ALREADY_COMPLETE');
  });
});

describe('User Management', () => {
  it('should create user with all PRD fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'كاشير 1',
        username: 'cashier1',
        password: 'SecurePass123!',
        role: 'cashier',
        preferredLanguage: 'ar'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.workStartDate).toBeDefined();
    expect(response.body.defaultBranchId).toBeDefined();
  });

  it('should list users with login status', async () => {
    // Login as user1
    await login('user1', 'pass');
    
    // List users
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    const user1 = response.body.data.find(u => u.username === 'user1');
    expect(user1.isLoggedIn).toBe(true);
    expect(user1.lastLoginAt).toBeDefined();
  });
});

describe('Session Management', () => {
  it('should track login status correctly', async () => {
    const loginResponse = await login('user1', 'pass');
    const userResponse = await getUser(loginResponse.user.id, adminToken);
    
    expect(userResponse.isLoggedIn).toBe(true);
  });

  it('should clear login status on logout', async () => {
    const { accessToken, user } = await login('user1', 'pass');
    await logout(accessToken);
    
    const userResponse = await getUser(user.id, adminToken);
    expect(userResponse.isLoggedIn).toBe(false);
  });
});
```

#### API Endpoint Tests
- Test all `/auth/*` endpoints with valid and invalid inputs
- Test all `/users/*` endpoints with different roles
- Test permission boundaries (cashier trying to access admin endpoints)

### Manual Verification

1. **First-Time Setup**
   - Access system before setup → should redirect to setup page
   - Complete setup wizard → should create admin and log in
   - Try setup again → should show "already complete" error

2. **User Management Dashboard**
   - View users list → verify all fields display correctly
   - Check "is logged in" status → verify real-time accuracy
   - Filter by role, status, branch → verify filters work
   - Sort by work start date → verify chronological order

3. **Login Flow**
   - Login as cashier → verify limited dashboard access
   - Logout → verify session cleared
   - Try changing password as non-admin → verify alert/redirect to admin

4. **Multi-Language**
   - Set user preference to Arabic → verify UI strings
   - Set user preference to English → verify UI strings
   - Verify error messages in both languages

### Acceptance Criteria

- [ ] First-time setup flow creates business name, admin user, and main branch
- [ ] Users page shows all required fields: name, username, role, branch, status, last login, login status, work start date
- [ ] Login status accurately reflects current session state
- [ ] Admin can add users with full name, username, password, role, branch selection, and language
- [ ] Default branch can be selected from available branches when creating users
- [ ] Non-admin users cannot change their own password (alert shown)
- [ ] All error messages appear in both Arabic and English
- [ ] Audit logs capture all user creation, login, and logout events
- [ ] System prevents duplicate setup attempts
- [ ] Multi-branch support is fully functional
- [ ] Admin can create, edit, and deactivate branches
- [ ] Cross-branch inventory transfers are supported
- [ ] Branch-specific reports can be generated

---

## Rollback Strategy

If issues arise during deployment:

1. **Database Rollback**
   ```bash
   # Revert migrations
   npx prisma migrate resolve --rolled-back 20260208_add_user_tracking_fields
   npx prisma migrate resolve --rolled-back 20260208_add_system_settings
   ```

2. **API Rollback**
   - Deploy previous version from git tag
   - Remove new endpoints from routing

3. **Data Consistency**
   - Backup database before migration
   - Test migration on staging environment first
   - Use database transactions for multi-step operations

---

## Timeline Estimate

- **Database Changes**: 1 day
  - Schema updates
  - Migrations
  - Seed data

- **API Development**: 3 days
  - Setup endpoints
  - User management enhancements
  - Session tracking logic
  - Error handling

- **Testing**: 2 days
  - Unit tests
  - Integration tests
  - Manual testing

- **Documentation**: 1 day
  - API docs
  - Setup guide
  - Admin user guide

**Total: 5-7 working days**

---

## Security Considerations

1. **Password Policy**
   - Minimum 8 characters
   - Bcrypt hashing with 12 rounds
   - Clear all sessions on password change

2. **Session Security**
   - Session tokens are UUIDs (non-predictable)
   - Stored session expiry prevents stale sessions
   - Logout clears both refresh and session tokens

3. **Setup Security**
   - Setup endpoint only works once
   - Requires strong password for admin
   - Creates audit log entry

4. **Permission Enforcement**
   - Role guards on all protected endpoints
   - Admin-only endpoints properly decorated
   - Permission checks in service layer
