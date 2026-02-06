-- =============================================================================
-- Migration 003: Parties (Customers & Suppliers)
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Customer and supplier master data
-- Dependencies: 001_init_core.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Table: customers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    phone TEXT,
    phone2 TEXT,
    email TEXT,
    address TEXT,
    credit_limit INTEGER NOT NULL DEFAULT 0,
    current_balance INTEGER NOT NULL DEFAULT 0,
    price_level TEXT DEFAULT 'standard',
    default_discount_pct INTEGER DEFAULT 0,
    tax_number TEXT,
    metadata TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_customers_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT chk_customers_price_level CHECK (price_level IN ('standard', 'wholesale', 'vip')),
    CONSTRAINT chk_customers_discount CHECK (default_discount_pct >= 0 AND default_discount_pct <= 10000),
    CONSTRAINT chk_customers_is_active CHECK (is_active IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    contact_person TEXT,
    tax_number TEXT,
    payment_terms TEXT,
    current_balance INTEGER NOT NULL DEFAULT 0,
    credit_limit INTEGER,
    bank_name TEXT,
    bank_account_number TEXT,
    rating INTEGER,
    metadata TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_suppliers_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT chk_suppliers_is_active CHECK (is_active IN (0, 1))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

CREATE INDEX IF NOT EXISTS idx_suppliers_number ON suppliers(supplier_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- Triggers
CREATE TRIGGER IF NOT EXISTS trg_customers_updated_at
AFTER UPDATE ON customers FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_suppliers_updated_at
AFTER UPDATE ON suppliers FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE suppliers SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('003', 'Parties - customers and suppliers');
