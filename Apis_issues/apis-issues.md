# API Issues Tracker

## Issue #1: Change Password API - Backend Corruption

**Date:** 2026-02-09  
**Status:** 🔄 In Progress - Backend Revert Needed  
**Module:** Authentication  
**Severity:** High

### Problem:
- `POST /v1/auth/change-password` returning 400 Bad Request
- Tested in Swagger - confirmed backend issue
- Backend version is corrupted (confirmed by backend team)

### Root Cause:
Backend codebase has corruption - needs to be reverted to last stable version

### Solution Plan:
1. ✅ Document all frontend changes (to preserve)
2. 🔄 Identify last good backend commit
3. ⏳ Revert backend only
4. ⏳ Keep all frontend changes intact
5. ⏳ Reinstall backend dependencies
6. ⏳ Test full auth flow

### Frontend Changes to Preserve:
- ✅ `auth.ts`: ChangePasswordDto with `currentPassword` field
- ✅ `Settings.tsx`: Complete Change Password UI with RTL layout
- ✅ `Settings.tsx`: Smart password validation (onBlur) with green indicator
- ✅ `Login.tsx`: Removed forgot password link
- ✅ All imports and dependencies (axios, etc.)

### Backend Files Affected (will be reverted):
- `app/backend/src/auth/*`
- `app/backend/package.json` (potentially)
- `app/backend/prisma/*` (potentially)

---

## Notes for Backend Team:
- Frontend is working correctly - DO NOT revert frontend
- Only revert `app/backend/` directory
- After revert: run `npm install` and `npm run db:push`
