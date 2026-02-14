-- =============================================================================
-- Migration 009: Chart of Accounts Rebuild (Blueprint 01)
-- Nested Set model, Company, account_id in journal_entry_lines
--
-- PREREQUISITE: Backup database before running.
-- For fresh installs: Use prisma db push + db:seed instead.
-- For existing data: Run this migration, then run data migration script.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    default_currency TEXT NOT NULL DEFAULT 'SAR',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO companies (id, code, name, default_currency) VALUES (1, 'DEFAULT', 'الشركة الافتراضية', 'SAR');

-- Step 2: Create new accounts table (Blueprint 01 schema)
CREATE TABLE IF NOT EXISTS accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    root_type TEXT NOT NULL,
    report_type TEXT NOT NULL,
    account_type TEXT NOT NULL,
    parent_id INTEGER,
    lft INTEGER NOT NULL DEFAULT 0,
    rgt INTEGER NOT NULL DEFAULT 0,
    is_group INTEGER NOT NULL DEFAULT 0,
    balance_must_be TEXT,
    account_currency TEXT,
    company_id INTEGER REFERENCES companies(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system_account INTEGER NOT NULL DEFAULT 0,
    freeze_account INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(code, company_id)
);

-- Step 3: Add account_id to journal_entry_lines (for migration from account_code)
ALTER TABLE journal_entry_lines ADD COLUMN account_id INTEGER;

-- Step 4: Copy accounts with mapping (root_type, report_type, is_group, parent_id)
-- Run this only if accounts table exists with old schema:
INSERT OR REPLACE INTO accounts_new (id, code, name, name_en, root_type, report_type, account_type, parent_id, is_group, company_id, is_active, is_system_account, created_at, updated_at)
SELECT
    a.id,
    a.code,
    a.name,
    a.name_en,
    CASE a.account_type
        WHEN 'asset' THEN 'Asset'
        WHEN 'liability' THEN 'Liability'
        WHEN 'equity' THEN 'Equity'
        WHEN 'revenue' THEN 'Income'
        WHEN 'expense' THEN 'Expense'
        ELSE 'Asset'
    END,
    CASE a.account_type
        WHEN 'asset' THEN 'Balance Sheet'
        WHEN 'liability' THEN 'Balance Sheet'
        WHEN 'equity' THEN 'Balance Sheet'
        WHEN 'revenue' THEN 'Profit and Loss'
        WHEN 'expense' THEN 'Profit and Loss'
        ELSE 'Balance Sheet'
    END,
    a.account_type,
    (SELECT an.id FROM accounts_new an WHERE an.code = a.parent_account_code AND an.company_id = 1 LIMIT 1),
    (SELECT COUNT(*) > 0 FROM accounts a2 WHERE a2.parent_account_code = a.code),
    1,
    COALESCE(a.is_active, 1),
    COALESCE(a.is_system_account, 0),
    a.created_at,
    a.updated_at
FROM accounts a
WHERE NOT EXISTS (SELECT 1 FROM accounts_new an WHERE an.id = a.id);

-- Step 5: Populate account_id in journal_entry_lines from account_code
UPDATE journal_entry_lines jel
SET account_id = (SELECT an.id FROM accounts_new an WHERE an.code = jel.account_code AND an.company_id = 1 LIMIT 1)
WHERE account_id IS NULL AND account_code IS NOT NULL;

-- Step 6: Drop old accounts, rename accounts_new
DROP TABLE IF EXISTS accounts;
ALTER TABLE accounts_new RENAME TO accounts;

-- Step 7: Recreate journal_entry_lines with account_id (SQLite: recreate table)
CREATE TABLE IF NOT EXISTS journal_entry_lines_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    debit_amount INTEGER NOT NULL DEFAULT 0,
    credit_amount INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(journal_entry_id, line_number)
);
INSERT INTO journal_entry_lines_new SELECT id, journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, created_at FROM journal_entry_lines WHERE account_id IS NOT NULL;
DROP TABLE journal_entry_lines;
ALTER TABLE journal_entry_lines_new RENAME TO journal_entry_lines;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_lft_rgt ON accounts(lft, rgt);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_versions (version, description) VALUES ('009', 'Blueprint 01: Chart of Accounts Rebuild');
