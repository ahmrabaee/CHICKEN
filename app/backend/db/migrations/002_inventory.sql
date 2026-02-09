-- =============================================================================
-- Migration 002: Inventory Tables
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Categories, items, inventory, lots, movements, wastage
-- Dependencies: 001_init_core.sql
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Table: categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    icon TEXT,
    default_shelf_life_days INTEGER,
    storage_type TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_categories_storage CHECK (storage_type IS NULL OR storage_type IN ('fresh', 'frozen', 'processed')),
    CONSTRAINT chk_categories_is_active CHECK (is_active IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    default_sale_price INTEGER NOT NULL,
    default_purchase_price INTEGER,
    tax_rate_pct INTEGER,
    min_stock_level_grams INTEGER,
    max_stock_level_grams INTEGER,
    shelf_life_days INTEGER,
    storage_location TEXT,
    requires_scale INTEGER NOT NULL DEFAULT 1,
    allow_negative_stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    metadata TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_items_sale_price CHECK (default_sale_price >= 0),
    CONSTRAINT chk_items_purchase_price CHECK (default_purchase_price IS NULL OR default_purchase_price >= 0),
    CONSTRAINT chk_items_tax_rate CHECK (tax_rate_pct IS NULL OR (tax_rate_pct >= 0 AND tax_rate_pct <= 10000)),
    CONSTRAINT chk_items_storage CHECK (storage_location IS NULL OR storage_location IN ('fridge', 'freezer', 'display')),
    CONSTRAINT chk_items_requires_scale CHECK (requires_scale IN (0, 1)),
    CONSTRAINT chk_items_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_items_negative_stock CHECK (allow_negative_stock IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: inventory
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    current_quantity_grams INTEGER NOT NULL DEFAULT 0,
    reserved_quantity_grams INTEGER NOT NULL DEFAULT 0,
    total_value INTEGER NOT NULL DEFAULT 0,
    average_cost INTEGER NOT NULL DEFAULT 0,
    last_restocked_at TEXT,
    last_sold_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_inventory_reserved_qty CHECK (reserved_quantity_grams >= 0)
);

-- -----------------------------------------------------------------------------
-- Table: inventory_lots
-- Note: purchase_id and purchase_line_id FKs added in migration 004
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    purchase_id INTEGER,
    purchase_line_id INTEGER,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    lot_number TEXT NOT NULL UNIQUE,
    batch_number TEXT,
    total_quantity_grams INTEGER NOT NULL,
    remaining_quantity_grams INTEGER NOT NULL,
    unit_purchase_price INTEGER NOT NULL,
    received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expiry_date TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_lots_total_qty CHECK (total_quantity_grams > 0),
    CONSTRAINT chk_lots_remaining CHECK (remaining_quantity_grams >= 0),
    CONSTRAINT chk_lots_remaining_lte_total CHECK (remaining_quantity_grams <= total_quantity_grams),
    CONSTRAINT chk_lots_unit_price CHECK (unit_purchase_price >= 0)
);

-- -----------------------------------------------------------------------------
-- Table: stock_movements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL,
    quantity_grams INTEGER NOT NULL,
    unit_cost INTEGER,
    reference_type TEXT,
    reference_id INTEGER,
    from_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    to_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    reason TEXT,
    movement_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_movements_type CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'transfer', 'waste', 'opening'))
);

-- -----------------------------------------------------------------------------
-- Table: wastage_records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wastage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    weight_grams INTEGER NOT NULL,
    wastage_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    estimated_cost_value INTEGER NOT NULL DEFAULT 0,
    photo_url TEXT,
    recorded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    wastage_date TEXT NOT NULL DEFAULT (date('now')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT chk_wastage_weight CHECK (weight_grams > 0),
    CONSTRAINT chk_wastage_type CHECK (wastage_type IN ('spoilage', 'trimming', 'expired', 'damaged', 'end_of_day', 'other')),
    CONSTRAINT chk_wastage_cost CHECK (estimated_cost_value >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_categories_storage ON categories(storage_type);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_is_active ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);

CREATE INDEX IF NOT EXISTS idx_lots_item_received ON inventory_lots(item_id, received_at);
CREATE INDEX IF NOT EXISTS idx_lots_item_remaining ON inventory_lots(item_id, remaining_quantity_grams) WHERE remaining_quantity_grams > 0;
CREATE INDEX IF NOT EXISTS idx_lots_expiry ON inventory_lots(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lots_branch ON inventory_lots(branch_id);

CREATE INDEX IF NOT EXISTS idx_movements_item_date ON stock_movements(item_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch ON stock_movements(branch_id);

CREATE INDEX IF NOT EXISTS idx_wastage_item ON wastage_records(item_id);
CREATE INDEX IF NOT EXISTS idx_wastage_date ON wastage_records(wastage_date);
CREATE INDEX IF NOT EXISTS idx_wastage_type ON wastage_records(wastage_type);
CREATE INDEX IF NOT EXISTS idx_wastage_branch ON wastage_records(branch_id);

-- Triggers
CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
AFTER UPDATE ON categories FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_items_updated_at
AFTER UPDATE ON items FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE items SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_inventory_updated_at
AFTER UPDATE ON inventory FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE inventory SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_lots_updated_at
AFTER UPDATE ON inventory_lots FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE inventory_lots SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_wastage_updated_at
AFTER UPDATE ON wastage_records FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE wastage_records SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id; END;

-- Auto-create inventory record for new items
CREATE TRIGGER IF NOT EXISTS trg_items_create_inventory
AFTER INSERT ON items FOR EACH ROW
BEGIN
    INSERT INTO inventory (item_id, current_quantity_grams, reserved_quantity_grams, total_value, average_cost)
    VALUES (NEW.id, 0, 0, 0, 0);
END;

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('002', 'Inventory tables - categories, items, lots, movements, wastage');
