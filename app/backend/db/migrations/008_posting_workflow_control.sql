-- =============================================================================
-- Migration 008: Posting Workflow Control (Blueprint 03)
-- Adds docstatus, period locking, and GL reversal support
-- =============================================================================

-- Accounting periods (for period locking)
CREATE TABLE IF NOT EXISTS accounting_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, start_date)
);
CREATE INDEX IF NOT EXISTS idx_acct_periods_closed ON accounting_periods(company_id, is_closed);

-- Sale: docstatus + workflow fields
ALTER TABLE sales ADD COLUMN docstatus INTEGER DEFAULT 1;
ALTER TABLE sales ADD COLUMN submitted_at TEXT;
ALTER TABLE sales ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN cancelled_at TEXT;
ALTER TABLE sales ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN cancel_reason TEXT;
UPDATE sales SET docstatus = 1 WHERE is_voided = 0;
UPDATE sales SET docstatus = 2 WHERE is_voided = 1;
UPDATE sales SET submitted_at = created_at, submitted_by = cashier_id WHERE docstatus = 1;
UPDATE sales SET cancelled_at = voided_at, cancelled_by = voided_by, cancel_reason = void_reason WHERE docstatus = 2;
CREATE INDEX IF NOT EXISTS idx_sales_docstatus ON sales(docstatus);

-- Purchase: docstatus + workflow fields
ALTER TABLE purchases ADD COLUMN docstatus INTEGER DEFAULT 0;
ALTER TABLE purchases ADD COLUMN submitted_at TEXT;
ALTER TABLE purchases ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE purchases ADD COLUMN cancelled_at TEXT;
ALTER TABLE purchases ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE purchases ADD COLUMN cancel_reason TEXT;
UPDATE purchases SET docstatus = 1 WHERE is_approved = 1;
UPDATE purchases SET submitted_at = approved_at, submitted_by = approved_by WHERE docstatus = 1;
CREATE INDEX IF NOT EXISTS idx_purchases_docstatus ON purchases(docstatus);

-- Payment: docstatus + workflow fields
ALTER TABLE payments ADD COLUMN docstatus INTEGER DEFAULT 1;
ALTER TABLE payments ADD COLUMN cancelled_at TEXT;
ALTER TABLE payments ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN cancel_reason TEXT;
UPDATE payments SET docstatus = 1 WHERE is_voided = 0;
UPDATE payments SET docstatus = 2 WHERE is_voided = 1;
CREATE INDEX IF NOT EXISTS idx_payments_docstatus ON payments(docstatus);

-- Expense: docstatus + workflow fields
ALTER TABLE expenses ADD COLUMN docstatus INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN submitted_at TEXT;
ALTER TABLE expenses ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN cancelled_at TEXT;
ALTER TABLE expenses ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN cancel_reason TEXT;
UPDATE expenses SET docstatus = 1 WHERE is_approved = 1;
UPDATE expenses SET submitted_at = approved_at, submitted_by = approved_by WHERE docstatus = 1;
CREATE INDEX IF NOT EXISTS idx_expenses_docstatus ON expenses(docstatus);

-- WastageRecord: docstatus + workflow fields
ALTER TABLE wastage_records ADD COLUMN docstatus INTEGER DEFAULT 1;
ALTER TABLE wastage_records ADD COLUMN submitted_at TEXT;
ALTER TABLE wastage_records ADD COLUMN submitted_by INTEGER REFERENCES users(id);
UPDATE wastage_records SET submitted_at = created_at, submitted_by = recorded_by WHERE docstatus = 1;
CREATE INDEX IF NOT EXISTS idx_wastage_docstatus ON wastage_records(docstatus);

-- System settings for period lock (run seeds/004_settings.sql or insert)
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
  ('accounting_freeze_date', '', 'ISO date: no posting before this date', 'string', 'accounting', 1);
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
  ('period_lock_enabled', 'false', 'Enable period locking', 'boolean', 'accounting', 1);
