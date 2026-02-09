-- =============================================================================
-- Chicken Shop POS, Inventory & Accounting System
-- SQLite Database Schema v1.0.0
-- Generated: February 6, 2026
-- 
-- This schema is derived from the Chicken Shop PRD v2.0
-- All monetary values in minor units (fils/cents), weights in grams
-- =============================================================================

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- =============================================================================
-- SECTION 1: CORE SYSTEM TABLES
-- Dependencies: None (foundation tables)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: branches
-- PRD Section: 2.1 - Branch/Outlet Configuration
-- Description: Shop locations/branches for multi-branch support
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    code TEXT NOT NULL UNIQUE,                    -- e.g., "BR001"
    name TEXT NOT NULL,                           -- Arabic name (primary)
    name_en TEXT,                                 -- English name
    
    -- Contact
    address TEXT,
    phone TEXT,
    
    -- Scale configuration (branch-specific)
    has_scale INTEGER NOT NULL DEFAULT 1,         -- 1 = has weighing scale
    scale_com_port TEXT,                          -- e.g., "COM3"
    
    -- Status
    is_main_branch INTEGER NOT NULL DEFAULT 0,    -- 1 = headquarters
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Audit timestamps
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Constraints
    CONSTRAINT chk_branches_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_branches_is_main CHECK (is_main_branch IN (0, 1)),
    CONSTRAINT chk_branches_has_scale CHECK (has_scale IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: roles
-- PRD Section: 3.1 - Role Definitions
-- Description: System roles (Admin and Cashier only per PRD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    name TEXT NOT NULL UNIQUE,                    -- e.g., "admin", "cashier"
    name_ar TEXT NOT NULL,                        -- Arabic: "مدير", "كاشير"
    description TEXT,
    
    -- Permissions stored as JSON array
    permissions TEXT,                             -- JSON: ["sales.create", "sales.view", ...]
    
    -- System flag
    is_system_role INTEGER NOT NULL DEFAULT 0,    -- 1 = cannot delete
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_roles_name CHECK (name IN ('admin', 'cashier')),
    CONSTRAINT chk_roles_is_system CHECK (is_system_role IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: users
-- PRD Section: 4.2.8 - Users & Authentication
-- Description: System users (owners, cashiers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Authentication
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,                  -- bcrypt hash
    
    -- Profile
    full_name TEXT NOT NULL,                      -- Arabic name (primary)
    full_name_en TEXT,                            -- English name
    phone TEXT,
    employee_number TEXT UNIQUE,
    
    -- Preferences
    preferred_language TEXT NOT NULL DEFAULT 'ar', -- 'ar' or 'en'
    default_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Session
    last_login_at TEXT,
    refresh_token TEXT,
    refresh_token_expires_at TEXT,
    
    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Extended data (JSON)
    metadata TEXT,                                -- UI preferences, settings
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT chk_users_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_users_language CHECK (preferred_language IN ('ar', 'en'))
);

-- -----------------------------------------------------------------------------
-- Table: user_roles
-- PRD Section: 3.1 - Many-to-many user-role assignment
-- Description: Links users to roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    -- Assignment info
    assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Ensure unique assignment
    CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
);

-- =============================================================================
-- SECTION 2: PRODUCT & INVENTORY TABLES
-- Dependencies: branches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: categories
-- PRD Section: 4.2.1 - Product Categories
-- Description: Chicken product categories (Fresh, Frozen, Processed, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    code TEXT NOT NULL UNIQUE,                    -- e.g., "FRESH_WHOLE"
    name TEXT NOT NULL,                           -- Arabic name (primary)
    name_en TEXT,                                 -- English name
    
    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    icon TEXT,                                    -- UI icon identifier
    
    -- Chicken-specific
    default_shelf_life_days INTEGER,              -- Default days until expiry
    storage_type TEXT,                            -- 'fresh', 'frozen', 'processed'
    
    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_categories_storage CHECK (storage_type IS NULL OR storage_type IN ('fresh', 'frozen', 'processed')),
    CONSTRAINT chk_categories_is_active CHECK (is_active IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: items
-- PRD Section: 4.2.1 - Item (Chicken product master)
-- Description: Products sold by weight (kg only per PRD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    code TEXT NOT NULL UNIQUE,                    -- SKU: "CH-WHOLE-001"
    barcode TEXT UNIQUE,                          -- Barcode for scanning
    name TEXT NOT NULL,                           -- Arabic name (primary)
    name_en TEXT,                                 -- English name
    description TEXT,
    
    -- Category
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    
    -- Pricing (stored in minor units - fils/cents)
    default_sale_price INTEGER NOT NULL,          -- Price per kg in minor units
    default_purchase_price INTEGER,               -- Cost per kg in minor units
    
    -- Tax override (stored as basis points: 1500 = 15.00%)
    tax_rate_pct INTEGER,                         -- NULL = use system default
    
    -- Stock levels (stored in grams)
    min_stock_level_grams INTEGER,                -- Low stock alert threshold
    max_stock_level_grams INTEGER,                -- Overstock alert threshold
    
    -- Chicken-specific
    shelf_life_days INTEGER,                      -- Days until expiry
    storage_location TEXT,                        -- 'fridge', 'freezer', 'display'
    requires_scale INTEGER NOT NULL DEFAULT 1,    -- Must use scale for selling
    allow_negative_stock INTEGER NOT NULL DEFAULT 0,
    
    -- Media
    image_url TEXT,
    
    -- Extended data (JSON)
    metadata TEXT,                                -- isLiveBird, chickenPart, etc.
    
    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Audit
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
-- PRD Section: 4.2.2 - Current stock summary per item
-- Description: Aggregated inventory levels (computed from lots)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Link to item (1:1 relationship)
    item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Quantities (stored in grams)
    current_quantity_grams INTEGER NOT NULL DEFAULT 0,
    reserved_quantity_grams INTEGER NOT NULL DEFAULT 0,
    
    -- Value (computed from lots, stored in minor units)
    total_value INTEGER NOT NULL DEFAULT 0,       -- Sum of lot values
    average_cost INTEGER NOT NULL DEFAULT 0,      -- Weighted average cost per kg
    
    -- Last activity
    last_restocked_at TEXT,
    last_sold_at TEXT,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Note: Negative stock validation handled via trigger, not CHECK (SQLite limitation)
    CONSTRAINT chk_inventory_reserved_qty CHECK (reserved_quantity_grams >= 0)
);

-- -----------------------------------------------------------------------------
-- Table: inventory_lots
-- PRD Section: 4.2.2 - FIFO lot tracking
-- Description: Individual inventory lots for FIFO cost allocation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Links
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
    purchase_line_id INTEGER REFERENCES purchase_lines(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Lot identification
    lot_number TEXT NOT NULL UNIQUE,              -- LOT-YYYYMMDD-XXXX
    batch_number TEXT,                            -- Supplier batch reference
    
    -- Quantities (stored in grams)
    total_quantity_grams INTEGER NOT NULL,        -- Original received quantity
    remaining_quantity_grams INTEGER NOT NULL,    -- Not yet sold
    
    -- Cost (stored in minor units per kg)
    unit_purchase_price INTEGER NOT NULL,         -- Cost per kg in minor units
    
    -- Dates
    received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expiry_date TEXT,                             -- YYYY-MM-DD format
    
    -- Extended data (live bird tracking)
    metadata TEXT,                                -- JSON: gross_weight, net_weight, shrinkage
    
    -- Audit
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
-- PRD Section: 4.2.2 - Audit trail for inventory changes
-- Description: Records all inventory changes for traceability
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Links
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Movement details
    movement_type TEXT NOT NULL,                  -- 'purchase', 'sale', 'adjustment', 'transfer', 'waste', 'opening'
    quantity_grams INTEGER NOT NULL,              -- Positive = in, Negative = out
    unit_cost INTEGER,                            -- Cost per kg at time of movement
    
    -- Reference to source document
    reference_type TEXT,                          -- 'sale', 'purchase', 'adjustment', 'wastage'
    reference_id INTEGER,                         -- ID of source document
    
    -- Transfer specific
    from_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    to_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Reason/notes
    reason TEXT,
    
    -- Audit
    movement_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_movements_type CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'transfer', 'waste', 'opening'))
);

-- -----------------------------------------------------------------------------
-- Table: wastage_records
-- PRD Section: 4.2.2 - Critical for chicken shop daily tracking
-- Description: Spoilage, trimming, expiry tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wastage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Links
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    lot_id INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Wastage details (weight in grams)
    weight_grams INTEGER NOT NULL,
    wastage_type TEXT NOT NULL,                   -- 'spoilage', 'trimming', 'expired', 'damaged', 'end_of_day', 'other'
    reason TEXT NOT NULL,                         -- Required explanation
    
    -- Cost impact (minor units)
    estimated_cost_value INTEGER NOT NULL DEFAULT 0,
    
    -- Evidence
    photo_url TEXT,
    
    -- Workflow
    recorded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    
    -- Timing
    wastage_date TEXT NOT NULL DEFAULT (date('now')),
    notes TEXT,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_wastage_weight CHECK (weight_grams > 0),
    CONSTRAINT chk_wastage_type CHECK (wastage_type IN ('spoilage', 'trimming', 'expired', 'damaged', 'end_of_day', 'other')),
    CONSTRAINT chk_wastage_cost CHECK (estimated_cost_value >= 0)
);

-- =============================================================================
-- SECTION 3: PARTIES (CUSTOMERS & SUPPLIERS)
-- Dependencies: branches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: customers
-- PRD Section: 4.2.6 - Customer master
-- Description: Customers with credit management
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    customer_number TEXT NOT NULL UNIQUE,         -- C001, C002, etc.
    name TEXT NOT NULL,                           -- Arabic name (primary)
    name_en TEXT,
    
    -- Contact
    phone TEXT,
    phone2 TEXT,
    email TEXT,
    address TEXT,
    
    -- Credit management (amounts in minor units)
    credit_limit INTEGER NOT NULL DEFAULT 0,      -- Max outstanding balance
    current_balance INTEGER NOT NULL DEFAULT 0,   -- Sum of unpaid debts (computed)
    
    -- Pricing
    price_level TEXT DEFAULT 'standard',          -- 'standard', 'wholesale', 'vip'
    default_discount_pct INTEGER DEFAULT 0,       -- Basis points (500 = 5%)
    
    -- Tax
    tax_number TEXT,                              -- VAT registration
    
    -- Extended data
    metadata TEXT,                                -- JSON: loyalty points, etc.
    notes TEXT,
    
    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Audit
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
-- PRD Section: 4.2.6 - Supplier master (generalized from Merchant)
-- Description: Chicken suppliers/farms
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    supplier_number TEXT NOT NULL UNIQUE,         -- S001, S002, etc.
    name TEXT NOT NULL,                           -- Arabic name (primary)
    name_en TEXT,
    
    -- Contact
    phone TEXT,
    email TEXT,
    address TEXT,
    contact_person TEXT,
    
    -- Financial
    tax_number TEXT,
    payment_terms TEXT,                           -- "Net 30", "Cash on delivery"
    current_balance INTEGER NOT NULL DEFAULT 0,   -- Amount we owe (computed)
    credit_limit INTEGER,                         -- Our credit limit with them
    
    -- Banking
    bank_name TEXT,
    bank_account_number TEXT,
    
    -- Quality tracking
    rating INTEGER,                               -- 1-5 performance rating
    
    -- Extended
    metadata TEXT,
    notes TEXT,
    
    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT chk_suppliers_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT chk_suppliers_is_active CHECK (is_active IN (0, 1))
);

-- =============================================================================
-- SECTION 4: TRANSACTIONS (SALES, PURCHASES, PAYMENTS, DEBTS)
-- Dependencies: items, customers, suppliers, users, branches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: sales
-- PRD Section: 4.2.3 - Sales header
-- Description: Sales invoices with FIFO cost tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    sale_number TEXT NOT NULL UNIQUE,             -- SAL-000001
    sale_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Type
    sale_type TEXT NOT NULL DEFAULT 'cash',       -- 'cash', 'credit', 'mixed'
    
    -- Customer (NULL for walk-in)
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name TEXT,                           -- Cached or manual entry
    customer_phone TEXT,
    
    -- Staff
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Amounts (all in minor units)
    gross_total_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    discount_pct INTEGER,                         -- Basis points
    tax_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,      -- Final amount
    
    -- Cost & Profit (computed from FIFO allocations)
    total_cost INTEGER NOT NULL DEFAULT 0,
    total_profit INTEGER NOT NULL DEFAULT 0,
    
    -- Payment status
    payment_status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
    amount_paid INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,                                -- For credit sales
    
    -- Void tracking
    is_voided INTEGER NOT NULL DEFAULT 0,
    voided_at TEXT,
    voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT,
    
    -- Extended
    notes TEXT,
    metadata TEXT,                                -- JSON: scale readings, receipt count
    
    -- Audit
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
-- PRD Section: 4.2.3 - Sales line items (weight-based)
-- Description: Individual items in a sale
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Parent sale
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Item reference
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,                      -- Cached Arabic name
    item_code TEXT NOT NULL,                      -- Cached code
    
    -- Quantity (weight in grams - PRD: all sales by weight)
    weight_grams INTEGER NOT NULL,
    
    -- Pricing (minor units per kg)
    price_per_kg INTEGER NOT NULL,                -- Gross price
    discount_amount INTEGER NOT NULL DEFAULT 0,   -- Line-level discount
    net_price_per_kg INTEGER NOT NULL,            -- After discount
    
    -- Tax (basis points)
    tax_rate_pct INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    
    -- Totals (minor units)
    line_total_amount INTEGER NOT NULL,           -- weight * net_price + tax
    
    -- Cost tracking (from FIFO allocations)
    cost_per_kg INTEGER NOT NULL DEFAULT 0,       -- Weighted average from lots
    line_total_cost INTEGER NOT NULL DEFAULT 0,   -- Sum of cost allocations
    
    -- Extended
    metadata TEXT,                                -- JSON: scaleReading, manualEntry
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_sale_lines_weight CHECK (weight_grams > 0),
    CONSTRAINT chk_sale_lines_price CHECK (price_per_kg >= 0 AND net_price_per_kg >= 0),
    CONSTRAINT chk_sale_lines_amounts CHECK (line_total_amount >= 0),
    CONSTRAINT uq_sale_lines_order UNIQUE (sale_id, line_number)
);

-- -----------------------------------------------------------------------------
-- Table: sale_line_cost_allocations
-- PRD Section: 4.2.3 - FIFO cost tracking
-- Description: Links sale lines to inventory lots for FIFO costing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_line_cost_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Links
    sale_line_id INTEGER NOT NULL REFERENCES sale_lines(id) ON DELETE CASCADE,
    lot_id INTEGER NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    
    -- Allocation (grams)
    quantity_allocated_grams INTEGER NOT NULL,
    
    -- Cost at time of allocation (minor units per kg)
    unit_cost INTEGER NOT NULL,
    
    -- Total cost (minor units)
    total_cost INTEGER NOT NULL,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_allocations_qty CHECK (quantity_allocated_grams > 0),
    CONSTRAINT chk_allocations_cost CHECK (unit_cost >= 0 AND total_cost >= 0)
);

-- -----------------------------------------------------------------------------
-- Table: purchases
-- PRD Section: 4.2.4 - Purchase orders
-- Description: Purchases from suppliers (including live birds)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    purchase_number TEXT NOT NULL UNIQUE,         -- PUR-000001
    purchase_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Supplier
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_name TEXT NOT NULL,                  -- Cached
    supplier_invoice_number TEXT,                 -- Supplier's reference
    
    -- Amounts (minor units)
    total_amount INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    
    -- Payment
    payment_status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
    amount_paid INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    
    -- Receiving
    received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    received_at TEXT,
    
    -- Approval
    is_approved INTEGER NOT NULL DEFAULT 0,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    
    -- Branch
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Extended
    notes TEXT,
    metadata TEXT,                                -- JSON: live bird details
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT chk_purchases_amounts CHECK (total_amount >= 0 AND tax_amount >= 0),
    CONSTRAINT chk_purchases_status CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    CONSTRAINT chk_purchases_is_approved CHECK (is_approved IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: purchase_lines
-- PRD Section: 4.2.4 - Purchase line items
-- Description: Items in a purchase (supports live bird tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Parent purchase
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Item
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,                      -- Cached
    item_code TEXT NOT NULL,
    
    -- Quantity (weight in grams)
    weight_grams INTEGER NOT NULL,
    
    -- Pricing (minor units per kg)
    price_per_kg INTEGER NOT NULL,
    
    -- Tax
    tax_rate_pct INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    
    -- Total (minor units)
    line_total_amount INTEGER NOT NULL,
    
    -- Lot tracking
    lot_number TEXT,                              -- Assigned on receiving
    expiry_date TEXT,                             -- Calculated from shelf life
    
    -- Live bird specific
    is_live_bird INTEGER NOT NULL DEFAULT 0,
    
    -- Extended (live bird weights, shrinkage)
    metadata TEXT,                                -- JSON: gross_weight, net_weight, shrinkage_pct
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_purchase_lines_weight CHECK (weight_grams > 0),
    CONSTRAINT chk_purchase_lines_price CHECK (price_per_kg >= 0),
    CONSTRAINT chk_purchase_lines_is_live_bird CHECK (is_live_bird IN (0, 1)),
    CONSTRAINT uq_purchase_lines_order UNIQUE (purchase_id, line_number)
);

-- -----------------------------------------------------------------------------
-- Table: payments
-- PRD Section: 4.2.5 - Payment records
-- Description: Payment receipts and disbursements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    payment_number TEXT NOT NULL UNIQUE,          -- PAY-000001
    payment_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Amount (minor units)
    amount INTEGER NOT NULL,
    
    -- Method
    payment_method TEXT NOT NULL,                 -- 'cash', 'card', 'bank_transfer', 'mobile', 'check'
    
    -- Reference (polymorphic)
    reference_type TEXT NOT NULL,                 -- 'sale', 'purchase', 'expense', 'debt'
    reference_id INTEGER NOT NULL,
    
    -- Payer/Payee
    party_type TEXT,                              -- 'customer', 'supplier'
    party_id INTEGER,                             -- customer_id or supplier_id
    party_name TEXT,
    
    -- Details
    receipt_number TEXT,
    bank_transaction_id TEXT,                     -- For electronic payments
    
    -- Staff/branch
    received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Status
    is_voided INTEGER NOT NULL DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    -- Audit
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
-- PRD Section: 4.2.5 - Receivables and Payables
-- Description: Track money owed to us (customers) and by us (suppliers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    debt_number TEXT NOT NULL UNIQUE,             -- DEB-000001
    
    -- Direction
    direction TEXT NOT NULL,                      -- 'receivable' (owed to us), 'payable' (we owe)
    
    -- Party
    party_type TEXT NOT NULL,                     -- 'customer', 'supplier'
    party_id INTEGER,                             -- customer_id or supplier_id
    party_name TEXT NOT NULL,
    
    -- Amounts (minor units)
    total_amount INTEGER NOT NULL,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    
    -- Dates
    due_date TEXT,
    
    -- Source document
    source_type TEXT NOT NULL,                    -- 'sale', 'purchase', 'expense'
    source_id INTEGER NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'open',          -- 'open', 'partial', 'paid', 'overdue', 'written_off'
    
    -- Branch
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_debts_direction CHECK (direction IN ('receivable', 'payable')),
    CONSTRAINT chk_debts_party_type CHECK (party_type IN ('customer', 'supplier', 'employee', 'other')),
    CONSTRAINT chk_debts_amounts CHECK (total_amount >= 0 AND amount_paid >= 0),
    CONSTRAINT chk_debts_source CHECK (source_type IN ('sale', 'purchase', 'expense')),
    CONSTRAINT chk_debts_status CHECK (status IN ('open', 'partial', 'paid', 'overdue', 'written_off'))
);

-- =============================================================================
-- SECTION 5: EXPENSES
-- Dependencies: suppliers, users, branches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: expense_categories
-- PRD Section: 4.2.7 - Expense classification
-- Description: Categories for expense tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,                           -- Arabic
    name_en TEXT,
    
    -- Accounting link
    account_code TEXT,                            -- Link to chart of accounts
    
    -- Hierarchy
    parent_category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    
    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_expense_cat_is_active CHECK (is_active IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: expenses
-- PRD Section: 4.2.7 - Operating expenses
-- Description: Business expenses with approval workflow
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    expense_number TEXT NOT NULL UNIQUE,          -- EXP-000001
    expense_date TEXT NOT NULL DEFAULT (date('now')),
    
    -- Type & Category
    expense_type TEXT NOT NULL,                   -- 'operational', 'personal', 'payroll', 'utilities', 'rent', 'maintenance', 'other'
    category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    
    -- Amount (minor units)
    amount INTEGER NOT NULL,
    tax_amount INTEGER DEFAULT 0,
    
    -- Description
    description TEXT NOT NULL,
    
    -- Payment
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    payment_method TEXT,                          -- 'cash', 'card', 'bank_transfer', etc.
    reference_number TEXT,                        -- Invoice/receipt number
    
    -- Approval
    is_approved INTEGER NOT NULL DEFAULT 0,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    
    -- Branch
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Attachment
    attachment_url TEXT,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    CONSTRAINT chk_expenses_type CHECK (expense_type IN ('operational', 'personal', 'payroll', 'utilities', 'rent', 'maintenance', 'other')),
    CONSTRAINT chk_expenses_amount CHECK (amount > 0),
    CONSTRAINT chk_expenses_is_approved CHECK (is_approved IN (0, 1))
);

-- =============================================================================
-- SECTION 6: ACCOUNTING (DOUBLE-ENTRY LEDGER)
-- Dependencies: users, branches
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: accounts
-- PRD Section: 6.1 - Chart of Accounts
-- Description: Account hierarchy for double-entry bookkeeping
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    code TEXT NOT NULL UNIQUE,                    -- "1100", "4010"
    name TEXT NOT NULL,                           -- Arabic
    name_en TEXT,
    
    -- Classification
    account_type TEXT NOT NULL,                   -- 'asset', 'liability', 'equity', 'revenue', 'expense'
    
    -- Hierarchy
    parent_account_code TEXT REFERENCES accounts(code) ON DELETE SET NULL,
    
    -- Flags
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system_account INTEGER NOT NULL DEFAULT 0, -- Cannot be deleted
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_accounts_type CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    CONSTRAINT chk_accounts_is_active CHECK (is_active IN (0, 1)),
    CONSTRAINT chk_accounts_is_system CHECK (is_system_account IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: journal_entries
-- PRD Section: 6.2 - Double-Entry Ledger
-- Description: Journal entry headers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identification
    entry_number TEXT NOT NULL UNIQUE,            -- JE-000001
    entry_date TEXT NOT NULL DEFAULT (date('now')),
    
    -- Description
    description TEXT NOT NULL,
    
    -- Source document
    source_type TEXT,                             -- 'sale', 'purchase', 'payment', 'adjustment', 'expense'
    source_id INTEGER,
    
    -- Status
    is_posted INTEGER NOT NULL DEFAULT 0,         -- 1 = posted to ledger
    is_reversed INTEGER NOT NULL DEFAULT 0,       -- 1 = reversed by another entry
    reversed_by_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
    
    -- Branch
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT chk_je_is_posted CHECK (is_posted IN (0, 1)),
    CONSTRAINT chk_je_is_reversed CHECK (is_reversed IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- Table: journal_entry_lines
-- PRD Section: 6.2 - Journal debit/credit lines
-- Description: Individual debit/credit entries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Parent entry
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Account
    account_code TEXT NOT NULL REFERENCES accounts(code) ON DELETE RESTRICT,
    
    -- Amounts (minor units) - exactly one should be > 0
    debit_amount INTEGER NOT NULL DEFAULT 0,
    credit_amount INTEGER NOT NULL DEFAULT 0,
    
    -- Description
    description TEXT,
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_jel_amounts CHECK (
        (debit_amount >= 0 AND credit_amount >= 0) AND
        (debit_amount > 0 OR credit_amount > 0) AND
        NOT (debit_amount > 0 AND credit_amount > 0)
    ),
    CONSTRAINT uq_jel_order UNIQUE (journal_entry_id, line_number)
);

-- =============================================================================
-- SECTION 7: SYSTEM CONFIGURATION & AUDIT
-- Dependencies: users
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: system_settings
-- PRD Section: 2.1 - System Configuration
-- Description: Key-value store for system settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Key-value
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,                          -- JSON serialized
    
    -- Meta
    description TEXT,
    data_type TEXT NOT NULL DEFAULT 'string',     -- 'string', 'number', 'boolean', 'json'
    setting_group TEXT,                           -- 'general', 'tax', 'numbering', 'scale', etc.
    
    -- Flags
    is_system INTEGER NOT NULL DEFAULT 0,         -- Cannot be deleted
    
    -- Audit
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    CONSTRAINT chk_settings_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'json'))
);

-- -----------------------------------------------------------------------------
-- Table: audit_logs
-- PRD Section: 4.2.9 - Compliance audit trail
-- Description: Immutable log of all critical system actions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Timing
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- User
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    
    -- Action
    action TEXT NOT NULL,                         -- 'create', 'update', 'delete', 'void', 'login', 'logout'
    
    -- Entity
    entity_type TEXT NOT NULL,                    -- 'sale', 'purchase', 'payment', etc.
    entity_id INTEGER,
    
    -- Changes (JSON: before/after)
    changes TEXT,
    
    -- Context
    ip_address TEXT,
    user_agent TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    
    -- Note: No updated_at - audit logs are immutable
    CONSTRAINT chk_audit_action CHECK (action IN ('create', 'update', 'delete', 'void', 'login', 'logout', 'view', 'export', 'approve', 'reject'))
);

-- -----------------------------------------------------------------------------
-- Table: schema_versions
-- Description: Track applied database migrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,                 -- "001", "002", etc.
    description TEXT,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    checksum TEXT                                 -- MD5/SHA of migration file
);

-- =============================================================================
-- SECTION 8: INDEXES
-- PRD Section: 4.4 - Critical Indexes for Performance
-- =============================================================================

-- Branches
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(default_branch_id);

-- User Roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_categories_storage ON categories(storage_type);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Items
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_is_active ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);

-- Inventory Lots (CRITICAL for FIFO)
CREATE INDEX IF NOT EXISTS idx_lots_item_received ON inventory_lots(item_id, received_at);
CREATE INDEX IF NOT EXISTS idx_lots_item_remaining ON inventory_lots(item_id, remaining_quantity_grams) WHERE remaining_quantity_grams > 0;
CREATE INDEX IF NOT EXISTS idx_lots_expiry ON inventory_lots(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lots_branch ON inventory_lots(branch_id);
CREATE INDEX IF NOT EXISTS idx_lots_purchase ON inventory_lots(purchase_id);

-- Stock Movements
CREATE INDEX IF NOT EXISTS idx_movements_item_date ON stock_movements(item_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch ON stock_movements(branch_id);

-- Wastage Records
CREATE INDEX IF NOT EXISTS idx_wastage_item ON wastage_records(item_id);
CREATE INDEX IF NOT EXISTS idx_wastage_date ON wastage_records(wastage_date);
CREATE INDEX IF NOT EXISTS idx_wastage_type ON wastage_records(wastage_type);
CREATE INDEX IF NOT EXISTS idx_wastage_branch ON wastage_records(branch_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_number ON suppliers(supplier_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_is_voided ON sales(is_voided);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, sale_date DESC);

-- Sale Lines
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_item ON sale_lines(item_id);

-- Sale Line Cost Allocations
CREATE INDEX IF NOT EXISTS idx_allocations_sale_line ON sale_line_cost_allocations(sale_line_id);
CREATE INDEX IF NOT EXISTS idx_allocations_lot ON sale_line_cost_allocations(lot_id);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_is_approved ON purchases(is_approved);

-- Purchase Lines
CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_item ON purchase_lines(item_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_number ON payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch_id);

-- Debts
CREATE INDEX IF NOT EXISTS idx_debts_number ON debts(debt_number);
CREATE INDEX IF NOT EXISTS idx_debts_direction ON debts(direction);
CREATE INDEX IF NOT EXISTS idx_debts_party ON debts(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date) WHERE status NOT IN ('paid', 'written_off');
CREATE INDEX IF NOT EXISTS idx_debts_source ON debts(source_type, source_id);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_number ON expenses(expense_number);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_is_approved ON expenses(is_approved);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_code);

-- Journal Entries
CREATE INDEX IF NOT EXISTS idx_je_number ON journal_entries(entry_number);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_je_is_posted ON journal_entries(is_posted);

-- Journal Entry Lines
CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_code);

-- System Settings
CREATE INDEX IF NOT EXISTS idx_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_group ON system_settings(setting_group);

-- Audit Logs (CRITICAL for compliance queries)
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id);

-- =============================================================================
-- SECTION 9: TRIGGERS
-- Automatic updated_at maintenance and business logic
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Trigger: Update timestamps on modification
-- -----------------------------------------------------------------------------

-- Branches
CREATE TRIGGER IF NOT EXISTS trg_branches_updated_at
AFTER UPDATE ON branches
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE branches SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Roles
CREATE TRIGGER IF NOT EXISTS trg_roles_updated_at
AFTER UPDATE ON roles
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE roles SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Users
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Categories
CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Items
CREATE TRIGGER IF NOT EXISTS trg_items_updated_at
AFTER UPDATE ON items
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE items SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Inventory
CREATE TRIGGER IF NOT EXISTS trg_inventory_updated_at
AFTER UPDATE ON inventory
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE inventory SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Inventory Lots
CREATE TRIGGER IF NOT EXISTS trg_lots_updated_at
AFTER UPDATE ON inventory_lots
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE inventory_lots SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Wastage Records
CREATE TRIGGER IF NOT EXISTS trg_wastage_updated_at
AFTER UPDATE ON wastage_records
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE wastage_records SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Customers
CREATE TRIGGER IF NOT EXISTS trg_customers_updated_at
AFTER UPDATE ON customers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Suppliers
CREATE TRIGGER IF NOT EXISTS trg_suppliers_updated_at
AFTER UPDATE ON suppliers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE suppliers SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Sales
CREATE TRIGGER IF NOT EXISTS trg_sales_updated_at
AFTER UPDATE ON sales
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sales SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Purchases
CREATE TRIGGER IF NOT EXISTS trg_purchases_updated_at
AFTER UPDATE ON purchases
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE purchases SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Payments
CREATE TRIGGER IF NOT EXISTS trg_payments_updated_at
AFTER UPDATE ON payments
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE payments SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Debts
CREATE TRIGGER IF NOT EXISTS trg_debts_updated_at
AFTER UPDATE ON debts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE debts SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Expense Categories
CREATE TRIGGER IF NOT EXISTS trg_expense_categories_updated_at
AFTER UPDATE ON expense_categories
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE expense_categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Expenses
CREATE TRIGGER IF NOT EXISTS trg_expenses_updated_at
AFTER UPDATE ON expenses
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE expenses SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Accounts
CREATE TRIGGER IF NOT EXISTS trg_accounts_updated_at
AFTER UPDATE ON accounts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE accounts SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Journal Entries
CREATE TRIGGER IF NOT EXISTS trg_je_updated_at
AFTER UPDATE ON journal_entries
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE journal_entries SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- System Settings
CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
AFTER UPDATE ON system_settings
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE system_settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- -----------------------------------------------------------------------------
-- Trigger: Create inventory record when new item is added
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_items_create_inventory
AFTER INSERT ON items
FOR EACH ROW
BEGIN
    INSERT INTO inventory (item_id, current_quantity_grams, reserved_quantity_grams, total_value, average_cost)
    VALUES (NEW.id, 0, 0, 0, 0);
END;

-- -----------------------------------------------------------------------------
-- Trigger: Ensure only one main branch
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_branches_single_main
BEFORE UPDATE ON branches
FOR EACH ROW
WHEN NEW.is_main_branch = 1 AND OLD.is_main_branch = 0
BEGIN
    UPDATE branches SET is_main_branch = 0 WHERE id != NEW.id AND is_main_branch = 1;
END;

-- =============================================================================
-- SECTION 10: VIEWS (Optional - for common queries)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- View: Available inventory lots (FIFO order)
-- Used by: Sales processing for cost allocation
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_available_lots AS
SELECT 
    il.id,
    il.item_id,
    i.code AS item_code,
    i.name AS item_name,
    il.lot_number,
    il.remaining_quantity_grams,
    ROUND(il.remaining_quantity_grams / 1000.0, 3) AS remaining_quantity_kg,
    il.unit_purchase_price,
    ROUND(il.unit_purchase_price / 100.0, 2) AS unit_purchase_price_major,
    il.expiry_date,
    il.received_at,
    il.branch_id
FROM inventory_lots il
JOIN items i ON i.id = il.item_id
WHERE il.remaining_quantity_grams > 0
ORDER BY il.item_id, il.received_at ASC;

-- -----------------------------------------------------------------------------
-- View: Customer balances
-- Used by: Customer listing, credit checks
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_customer_balances AS
SELECT 
    c.id,
    c.customer_number,
    c.name,
    c.phone,
    c.credit_limit,
    ROUND(c.credit_limit / 100.0, 2) AS credit_limit_major,
    COALESCE(SUM(CASE WHEN d.status != 'paid' THEN d.total_amount - d.amount_paid ELSE 0 END), 0) AS outstanding_balance,
    ROUND(COALESCE(SUM(CASE WHEN d.status != 'paid' THEN d.total_amount - d.amount_paid ELSE 0 END), 0) / 100.0, 2) AS outstanding_balance_major,
    c.is_active
FROM customers c
LEFT JOIN debts d ON d.party_type = 'customer' AND d.party_id = c.id AND d.direction = 'receivable'
GROUP BY c.id;

-- -----------------------------------------------------------------------------
-- View: Daily sales summary
-- Used by: Dashboard, Z-Report
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_daily_sales_summary AS
SELECT 
    date(sale_date) AS sale_day,
    branch_id,
    COUNT(*) AS transaction_count,
    SUM(CASE WHEN is_voided = 0 THEN 1 ELSE 0 END) AS valid_transactions,
    SUM(CASE WHEN is_voided = 0 THEN total_amount ELSE 0 END) AS total_sales,
    SUM(CASE WHEN is_voided = 0 AND sale_type = 'cash' THEN total_amount ELSE 0 END) AS cash_sales,
    SUM(CASE WHEN is_voided = 0 AND sale_type = 'credit' THEN total_amount ELSE 0 END) AS credit_sales,
    SUM(CASE WHEN is_voided = 0 THEN total_profit ELSE 0 END) AS total_profit,
    SUM(CASE WHEN is_voided = 0 THEN discount_amount ELSE 0 END) AS total_discounts,
    SUM(CASE WHEN is_voided = 1 THEN 1 ELSE 0 END) AS voided_count
FROM sales
GROUP BY date(sale_date), branch_id;

-- -----------------------------------------------------------------------------
-- View: Low stock items
-- Used by: Dashboard alerts, inventory reports
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_low_stock_items AS
SELECT 
    i.id,
    i.code,
    i.name,
    c.name AS category_name,
    inv.current_quantity_grams,
    ROUND(inv.current_quantity_grams / 1000.0, 3) AS current_quantity_kg,
    i.min_stock_level_grams,
    ROUND(i.min_stock_level_grams / 1000.0, 3) AS min_stock_level_kg,
    CASE 
        WHEN inv.current_quantity_grams = 0 THEN 'out_of_stock'
        WHEN inv.current_quantity_grams < i.min_stock_level_grams THEN 'low_stock'
        ELSE 'ok'
    END AS stock_status
FROM items i
JOIN inventory inv ON inv.item_id = i.id
JOIN categories c ON c.id = i.category_id
WHERE i.is_active = 1 
  AND i.min_stock_level_grams IS NOT NULL
  AND inv.current_quantity_grams < i.min_stock_level_grams;

-- -----------------------------------------------------------------------------
-- View: Expiring lots (within 7 days)
-- Used by: Dashboard alerts, wastage prevention
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_expiring_lots AS
SELECT 
    il.id,
    il.lot_number,
    i.code AS item_code,
    i.name AS item_name,
    c.name AS category_name,
    il.remaining_quantity_grams,
    ROUND(il.remaining_quantity_grams / 1000.0, 3) AS remaining_quantity_kg,
    il.expiry_date,
    julianday(il.expiry_date) - julianday(date('now')) AS days_until_expiry,
    il.branch_id
FROM inventory_lots il
JOIN items i ON i.id = il.item_id
JOIN categories c ON c.id = i.category_id
WHERE il.remaining_quantity_grams > 0
  AND il.expiry_date IS NOT NULL
  AND julianday(il.expiry_date) - julianday(date('now')) <= 7
ORDER BY il.expiry_date ASC;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================

-- Record schema version
INSERT OR IGNORE INTO schema_versions (version, description) 
VALUES ('001', 'Initial schema - Core tables for Chicken Shop POS');
