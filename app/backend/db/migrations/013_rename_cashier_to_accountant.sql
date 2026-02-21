-- =============================================================================
-- Migration 013: Rename cashier role to accountant
-- 
-- Description: Updates role name from 'cashier' to 'accountant' (محاسب)
-- SQLite requires table recreation to modify CHECK constraint
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- Create new roles table with updated CHECK constraint
CREATE TABLE roles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    description TEXT,
    permissions TEXT,
    is_system_role INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_roles_name CHECK (name IN ('admin', 'accountant')),
    CONSTRAINT chk_roles_is_system CHECK (is_system_role IN (0, 1))
);

-- Copy data, renaming cashier to accountant
INSERT INTO roles_new (id, name, name_ar, description, permissions, is_system_role, created_at, updated_at)
SELECT 
    id,
    CASE WHEN name = 'cashier' THEN 'accountant' ELSE name END,
    CASE WHEN name = 'cashier' THEN 'محاسب' ELSE name_ar END,
    CASE WHEN name = 'cashier' THEN 'Limited access: POS, sales, customers, payments, basic reports' ELSE description END,
    permissions,
    is_system_role,
    created_at,
    updated_at
FROM roles;

-- Replace old table
DROP TABLE roles;
ALTER TABLE roles_new RENAME TO roles;

PRAGMA foreign_keys = ON;

-- Update existing sample user from cashier1 to accountant1 (if exists)
UPDATE users SET username = 'accountant1', full_name = 'أحمد المحاسب', full_name_en = 'Ahmad Accountant' WHERE username = 'cashier1';
