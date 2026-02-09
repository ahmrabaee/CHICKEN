-- =============================================================================
-- Migration 004: Transactions (Sales, Purchases, Payments, Debts)
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Core transaction tables
-- Dependencies: 001_init_core.sql, 002_inventory.sql, 003_parties.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Table: sales
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number TEXT NOT NULL UNIQUE,
    sale_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    sale_type TEXT NOT NULL DEFAULT 'cash',
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name TEXT,
    customer_phone TEXT,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    gross_total_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    discount_pct INTEGER,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    total_cost INTEGER NOT NULL DEFAULT 0,
    total_profit INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    amount_paid INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    is_voided INTEGER NOT NULL DEFAULT 0,
    voided_at TEXT,
    voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT,
    notes TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_sales_type CHECK (sale_type IN ('cash', 'credit', 'mixed')),
    CONSTRAINT chk_sales_amounts CHECK (gross_total_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0),
    CONSTRAINT chk_sales_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    CONSTRAINT chk_sales_is_voided CHECK (is_voided IN (0, 1)),
    CONSTRAINT chk_sales_void_reason CHECK (is_voided = 0 OR (voided_at IS NOT NULL AND void_reason IS NOT NULL))
);

-- -----------------------------------------------------------------------------
-- Table: sale_lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    item_code TEXT NOT NULL,
    weight_grams INTEGER NOT NULL,
    price_per_kg INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    net_price_per_kg INTEGER NOT NULL,
    tax_rate_pct INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    line_total_amount INTEGER NOT NULL,
    cost_per_kg INTEGER NOT NULL DEFAULT 0,
    line_total_cost INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_sale_lines_weight CHECK (weight_grams > 0),
    CONSTRAINT chk_sale_lines_price CHECK (price_per_kg >= 0 AND net_price_per_kg >= 0),
    CONSTRAINT chk_sale_lines_amounts CHECK (line_total_amount >= 0),
    CONSTRAINT uq_sale_lines_order UNIQUE (sale_id, line_number)
);

-- -----------------------------------------------------------------------------
-- Table: sale_line_cost_allocations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_line_cost_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_line_id INTEGER NOT NULL REFERENCES sale_lines(id) ON DELETE CASCADE,
    lot_id INTEGER NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    quantity_allocated_grams INTEGER NOT NULL,
    unit_cost INTEGER NOT NULL,
    total_cost INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_allocations_qty CHECK (quantity_allocated_grams > 0),
    CONSTRAINT chk_allocations_cost CHECK (unit_cost >= 0 AND total_cost >= 0)
);

-- -----------------------------------------------------------------------------
-- Table: purchases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT NOT NULL UNIQUE,
    purchase_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_name TEXT NOT NULL,
    supplier_invoice_number TEXT,
    total_amount INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    amount_paid INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    received_at TEXT,
    is_approved INTEGER NOT NULL DEFAULT 0,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    notes TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_purchases_amounts CHECK (total_amount >= 0 AND tax_amount >= 0),
    CONSTRAINT chk_purchases_status CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    CONSTRAINT chk_purchases_is_approved CHECK (is_approved IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: purchase_lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    item_code TEXT NOT NULL,
    weight_grams INTEGER NOT NULL,
    price_per_kg INTEGER NOT NULL,
    tax_rate_pct INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    line_total_amount INTEGER NOT NULL,
    lot_number TEXT,
    expiry_date TEXT,
    is_live_bird INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_purchase_lines_weight CHECK (weight_grams > 0),
    CONSTRAINT chk_purchase_lines_price CHECK (price_per_kg >= 0),
    CONSTRAINT chk_purchase_lines_is_live_bird CHECK (is_live_bird IN (0, 1)),
    CONSTRAINT uq_purchase_lines_order UNIQUE (purchase_id, line_number)
);

-- Add FK to inventory_lots for purchase reference
-- Note: SQLite doesn't support adding constraints to existing tables,
-- so these FKs are handled in 002_inventory.sql with deferred reference

-- -----------------------------------------------------------------------------
-- Table: payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT NOT NULL UNIQUE,
    payment_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id INTEGER NOT NULL,
    party_type TEXT,
    party_id INTEGER,
    party_name TEXT,
    receipt_number TEXT,
    bank_transaction_id TEXT,
    received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    is_voided INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_payments_amount CHECK (amount != 0),
    CONSTRAINT chk_payments_method CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile', 'check')),
    CONSTRAINT chk_payments_ref_type CHECK (reference_type IN ('sale', 'purchase', 'expense', 'debt')),
    CONSTRAINT chk_payments_party_type CHECK (party_type IS NULL OR party_type IN ('customer', 'supplier')),
    CONSTRAINT chk_payments_is_voided CHECK (is_voided IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: debts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_number TEXT NOT NULL UNIQUE,
    direction TEXT NOT NULL,
    party_type TEXT NOT NULL,
    party_id INTEGER,
    party_name TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_debts_direction CHECK (direction IN ('receivable', 'payable')),
    CONSTRAINT chk_debts_party_type CHECK (party_type IN ('customer', 'supplier', 'employee', 'other')),
    CONSTRAINT chk_debts_amounts CHECK (total_amount >= 0 AND amount_paid >= 0),
    CONSTRAINT chk_debts_source CHECK (source_type IN ('sale', 'purchase', 'expense')),
    CONSTRAINT chk_debts_status CHECK (status IN ('open', 'partial', 'paid', 'overdue', 'written_off'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_is_voided ON sales(is_voided);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_item ON sale_lines(item_id);

CREATE INDEX IF NOT EXISTS idx_allocations_sale_line ON sale_line_cost_allocations(sale_line_id);
CREATE INDEX IF NOT EXISTS idx_allocations_lot ON sale_line_cost_allocations(lot_id);

CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_is_approved ON purchases(is_approved);

CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_item ON purchase_lines(item_id);

CREATE INDEX IF NOT EXISTS idx_payments_number ON payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);

CREATE INDEX IF NOT EXISTS idx_debts_number ON debts(debt_number);
CREATE INDEX IF NOT EXISTS idx_debts_direction ON debts(direction);
CREATE INDEX IF NOT EXISTS idx_debts_party ON debts(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date) WHERE status NOT IN ('paid', 'written_off');
CREATE INDEX IF NOT EXISTS idx_debts_source ON debts(source_type, source_id);

-- Add lot purchase index
CREATE INDEX IF NOT EXISTS idx_lots_purchase ON inventory_lots(purchase_id);

-- Triggers
CREATE TRIGGER IF NOT EXISTS trg_sales_updated_at
AFTER UPDATE ON sales FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE sales SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_purchases_updated_at
AFTER UPDATE ON purchases FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE purchases SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_payments_updated_at
AFTER UPDATE ON payments FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE payments SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_debts_updated_at
AFTER UPDATE ON debts FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE debts SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('004', 'Transactions - sales, purchases, payments, debts');
