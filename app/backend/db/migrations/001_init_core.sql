-- =============================================================================
-- Migration 001: Core System Tables
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Foundation tables (branches, roles, users)
-- Dependencies: None
-- =============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- -----------------------------------------------------------------------------
-- Table: branches
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    address TEXT,
    phone TEXT,
    has_scale INTEGER NOT NULL DEFAULT 1,
    scale_com_port TEXT,
    is_main_branch INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_branches_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_branches_is_main CHECK (is_main_branch IN (0, 1)),
    CONSTRAINT chk_branches_has_scale CHECK (has_scale IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    description TEXT,
    permissions TEXT,
    is_system_role INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_roles_name CHECK (name IN ('admin', 'cashier')),
    CONSTRAINT chk_roles_is_system CHECK (is_system_role IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    full_name_en TEXT,
    phone TEXT,
    employee_number TEXT UNIQUE,
    preferred_language TEXT NOT NULL DEFAULT 'ar',
    default_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    last_login_at TEXT,
    refresh_token TEXT,
    refresh_token_expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_users_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_users_language CHECK (preferred_language IN ('ar', 'en'))
);

-- -----------------------------------------------------------------------------
-- Table: user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- Table: schema_versions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    checksum TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(default_branch_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Triggers
CREATE TRIGGER IF NOT EXISTS trg_branches_updated_at
AFTER UPDATE ON branches FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE branches SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_roles_updated_at
AFTER UPDATE ON roles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE roles SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_branches_single_main
BEFORE UPDATE ON branches FOR EACH ROW WHEN NEW.is_main_branch = 1 AND OLD.is_main_branch = 0
BEGIN UPDATE branches SET is_main_branch = 0 WHERE id != NEW.id AND is_main_branch = 1; END;

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('001', 'Core system tables - branches, roles, users');
