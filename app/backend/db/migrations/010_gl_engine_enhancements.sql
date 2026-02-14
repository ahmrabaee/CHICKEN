-- =============================================================================
-- Migration 010: General Ledger Engine Enhancements (Blueprint 02)
-- Cost Centers, Company round-off, JournalEntryLine GL fields
--
-- PREREQUISITE: Migration 009 (Chart of Accounts Rebuild) applied
-- =============================================================================

-- 1. Cost Centers
CREATE TABLE IF NOT EXISTS cost_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(code, company_id)
);
CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON cost_centers(company_id);

INSERT INTO cost_centers (code, name, company_id)
SELECT 'main', 'المركز الرئيسي', 1
WHERE NOT EXISTS (SELECT 1 FROM cost_centers LIMIT 1);

-- 2. Company round-off fields
-- SQLite: ALTER ADD COLUMN for each new column
ALTER TABLE companies ADD COLUMN round_off_account_id INTEGER REFERENCES accounts(id);
ALTER TABLE companies ADD COLUMN round_off_cost_center_id INTEGER REFERENCES cost_centers(id);
ALTER TABLE companies ADD COLUMN currency_precision INTEGER DEFAULT 2;

-- 3. JournalEntryLine enhancements (Blueprint 02)
ALTER TABLE journal_entry_lines ADD COLUMN debit_in_account_currency INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN credit_in_account_currency INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN exchange_rate REAL;
ALTER TABLE journal_entry_lines ADD COLUMN cost_center_id INTEGER REFERENCES cost_centers(id);
ALTER TABLE journal_entry_lines ADD COLUMN company_id INTEGER REFERENCES companies(id);
ALTER TABLE journal_entry_lines ADD COLUMN party_type TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN party_id INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN against_voucher_type TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN against_voucher_id INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN voucher_detail_no TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN is_opening INTEGER DEFAULT 0;

-- 4. Backfill debit/credit in account currency
UPDATE journal_entry_lines SET debit_in_account_currency = debit_amount, credit_in_account_currency = credit_amount WHERE debit_in_account_currency IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_jel_company ON journal_entry_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_jel_cost_center ON journal_entry_lines(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_jel_party ON journal_entry_lines(party_type, party_id);

-- 6. SystemSetting for GL Engine
INSERT OR IGNORE INTO system_settings (key, value, data_type, description, is_system) VALUES
  ('gl_debit_credit_tolerance', '5', 'number', 'Tolerance in minor units (e.g. 5 = 0.05 when precision=2)', 1),
  ('gl_engine_enabled', 'false', 'boolean', 'Use new GL Engine (Phase 02)', 1);
