-- =============================================================================
-- Migration 011: Tax Engine & VAT Architecture (Blueprint 05)
-- TaxTemplate, TaxTemplateItem, Sale/Purchase tax fields
--
-- PREREQUISITE: Migration 010 (GL Engine), Chart of Accounts with VAT 2120
-- =============================================================================

-- 1. Tax Templates
CREATE TABLE IF NOT EXISTS tax_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tax_templates_type ON tax_templates(type);
CREATE INDEX IF NOT EXISTS idx_tax_templates_company ON tax_templates(company_id);

-- 2. Tax Template Items
CREATE TABLE IF NOT EXISTS tax_template_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES tax_templates(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  rate INTEGER NOT NULL,
  charge_type TEXT NOT NULL DEFAULT 'on_net_total',
  row_id INTEGER,
  fixed_amount INTEGER,
  is_deductible INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tax_template_items_template ON tax_template_items(template_id);

-- 3. Sale tax fields
ALTER TABLE sales ADD COLUMN tax_template_id INTEGER REFERENCES tax_templates(id);
ALTER TABLE sales ADD COLUMN net_total INTEGER;
ALTER TABLE sales ADD COLUMN total_tax_amount INTEGER DEFAULT 0;
ALTER TABLE sales ADD COLUMN grand_total INTEGER;

-- 4. Purchase tax fields
ALTER TABLE purchases ADD COLUMN tax_template_id INTEGER REFERENCES tax_templates(id);
ALTER TABLE purchases ADD COLUMN net_total INTEGER;
ALTER TABLE purchases ADD COLUMN total_tax_amount INTEGER DEFAULT 0;
ALTER TABLE purchases ADD COLUMN grand_total INTEGER;

-- 5. Sale Tax Breakdown (optional - for audit trail)
CREATE TABLE IF NOT EXISTS sale_tax_breakdowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  rate INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sale_tax_breakdowns_sale ON sale_tax_breakdowns(sale_id);

-- 6. Purchase Tax Breakdown
CREATE TABLE IF NOT EXISTS purchase_tax_breakdowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  rate INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_purchase_tax_breakdowns_purchase ON purchase_tax_breakdowns(purchase_id);

-- 7. SystemSetting for Tax Engine
INSERT OR IGNORE INTO system_settings (key, value, data_type, description, is_system) VALUES
  ('tax_engine_enabled', 'false', 'boolean', 'Use Tax Engine (Blueprint 05) - separate VAT GL posting', 1);

-- 8. Data migration: existing sales/purchases
-- When net_total is NULL, treat total_amount as net (no tax was applied)
UPDATE sales SET net_total = total_amount, total_tax_amount = COALESCE(tax_amount, 0), grand_total = total_amount WHERE net_total IS NULL;
UPDATE purchases SET net_total = total_amount, total_tax_amount = COALESCE(tax_amount, 0), grand_total = total_amount WHERE net_total IS NULL;
