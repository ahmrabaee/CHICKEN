-- =============================================================================
-- Migration 006: Audit & System Configuration
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: System settings, audit logs
-- Dependencies: 001_init_core.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Table: system_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT NOT NULL DEFAULT 'string',
    setting_group TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_settings_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'json'))
);

-- -----------------------------------------------------------------------------
-- Table: audit_logs (Immutable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT chk_audit_action CHECK (action IN ('create', 'update', 'delete', 'void', 'login', 'logout', 'view', 'export', 'approve', 'reject'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_group ON system_settings(setting_group);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id);

-- Triggers
CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
AFTER UPDATE ON system_settings FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE system_settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('006', 'Audit and system configuration - settings, audit logs');
