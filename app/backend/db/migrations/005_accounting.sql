-- =============================================================================
-- Migration 005: Accounting Tables
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Chart of accounts, journal entries, expenses
-- Dependencies: 001_init_core.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Table: expense_categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    account_code TEXT,
    parent_category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_expense_cat_is_active CHECK (is_active IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: expenses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_number TEXT NOT NULL UNIQUE,
    expense_date TEXT NOT NULL DEFAULT (date('now')),
    expense_type TEXT NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    tax_amount INTEGER DEFAULT 0,
    description TEXT NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    payment_method TEXT,
    reference_number TEXT,
    is_approved INTEGER NOT NULL DEFAULT 0,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    attachment_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_expenses_type CHECK (expense_type IN ('operational', 'personal', 'payroll', 'utilities', 'rent', 'maintenance', 'other')),
    CONSTRAINT chk_expenses_amount CHECK (amount > 0),
    CONSTRAINT chk_expenses_is_approved CHECK (is_approved IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: accounts (Chart of Accounts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    account_type TEXT NOT NULL,
    parent_account_code TEXT REFERENCES accounts(code) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system_account INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_accounts_type CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    CONSTRAINT chk_accounts_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_accounts_is_system CHECK (is_system_account IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: journal_entries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_number TEXT NOT NULL UNIQUE,
    entry_date TEXT NOT NULL DEFAULT (date('now')),
    description TEXT NOT NULL,
    source_type TEXT,
    source_id INTEGER,
    is_posted INTEGER NOT NULL DEFAULT 0,
    is_reversed INTEGER NOT NULL DEFAULT 0,
    reversed_by_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_je_is_posted CHECK (is_posted IN (0, 1)),
    CONSTRAINT chk_je_is_reversed CHECK (is_reversed IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: journal_entry_lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_code TEXT NOT NULL REFERENCES accounts(code) ON DELETE RESTRICT,
    debit_amount INTEGER NOT NULL DEFAULT 0,
    credit_amount INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_jel_amounts CHECK (
        (debit_amount >= 0 AND credit_amount >= 0) AND
        (debit_amount > 0 OR credit_amount > 0) AND
        NOT (debit_amount > 0 AND credit_amount > 0)
    ),
    CONSTRAINT uq_jel_order UNIQUE (journal_entry_id, line_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_number ON expenses(expense_number);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_is_approved ON expenses(is_approved);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);

CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_code);

CREATE INDEX IF NOT EXISTS idx_je_number ON journal_entries(entry_number);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_je_is_posted ON journal_entries(is_posted);

CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_code);

-- Triggers
CREATE TRIGGER IF NOT EXISTS trg_expense_categories_updated_at
AFTER UPDATE ON expense_categories FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE expense_categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_updated_at
AFTER UPDATE ON expenses FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE expenses SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_updated_at
AFTER UPDATE ON accounts FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE accounts SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_je_updated_at
AFTER UPDATE ON journal_entries FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE journal_entries SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('005', 'Accounting - expense categories, expenses, chart of accounts, journal entries');
