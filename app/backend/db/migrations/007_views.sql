-- =============================================================================
-- Migration 007: Views
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Common views for reporting and queries
-- Dependencies: All previous migrations
-- =============================================================================

PRAGMA foreign_keys = ON;

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
-- View: Supplier balances
-- Used by: Supplier listing, payables tracking
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_supplier_balances AS
SELECT 
    s.id,
    s.supplier_number,
    s.name,
    s.phone,
    COALESCE(SUM(CASE WHEN d.status != 'paid' THEN d.total_amount - d.amount_paid ELSE 0 END), 0) AS outstanding_balance,
    ROUND(COALESCE(SUM(CASE WHEN d.status != 'paid' THEN d.total_amount - d.amount_paid ELSE 0 END), 0) / 100.0, 2) AS outstanding_balance_major,
    s.is_active
FROM suppliers s
LEFT JOIN debts d ON d.party_type = 'supplier' AND d.party_id = s.id AND d.direction = 'payable'
GROUP BY s.id;

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

-- -----------------------------------------------------------------------------
-- View: Item inventory summary
-- Used by: Inventory listing
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_item_inventory AS
SELECT 
    i.id,
    i.code,
    i.name,
    i.name_en,
    c.code AS category_code,
    c.name AS category_name,
    i.default_sale_price,
    ROUND(i.default_sale_price / 100.0, 2) AS sale_price_major,
    inv.current_quantity_grams,
    ROUND(inv.current_quantity_grams / 1000.0, 3) AS current_quantity_kg,
    inv.total_value,
    ROUND(inv.total_value / 100.0, 2) AS total_value_major,
    inv.average_cost,
    ROUND(inv.average_cost / 100.0, 2) AS average_cost_major,
    i.min_stock_level_grams,
    i.shelf_life_days,
    inv.last_restocked_at,
    inv.last_sold_at,
    i.is_active,
    CASE 
        WHEN inv.current_quantity_grams = 0 THEN 'out_of_stock'
        WHEN i.min_stock_level_grams IS NOT NULL AND inv.current_quantity_grams < i.min_stock_level_grams THEN 'low_stock'
        WHEN i.max_stock_level_grams IS NOT NULL AND inv.current_quantity_grams > i.max_stock_level_grams THEN 'over_stock'
        ELSE 'ok'
    END AS stock_status
FROM items i
JOIN categories c ON c.id = i.category_id
JOIN inventory inv ON inv.item_id = i.id;

-- -----------------------------------------------------------------------------
-- View: Wastage summary by date
-- Used by: Wastage reports
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_wastage_summary AS
SELECT 
    wastage_date,
    branch_id,
    wastage_type,
    COUNT(*) AS record_count,
    SUM(weight_grams) AS total_weight_grams,
    ROUND(SUM(weight_grams) / 1000.0, 3) AS total_weight_kg,
    SUM(estimated_cost_value) AS total_cost_value,
    ROUND(SUM(estimated_cost_value) / 100.0, 2) AS total_cost_value_major
FROM wastage_records
GROUP BY wastage_date, branch_id, wastage_type;

-- -----------------------------------------------------------------------------
-- View: Outstanding debts (receivables)
-- Used by: Debts reporting, collections
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_outstanding_receivables AS
SELECT 
    d.id,
    d.debt_number,
    d.party_name,
    c.phone,
    d.total_amount,
    d.amount_paid,
    d.total_amount - d.amount_paid AS amount_remaining,
    ROUND((d.total_amount - d.amount_paid) / 100.0, 2) AS amount_remaining_major,
    d.due_date,
    CASE 
        WHEN d.due_date IS NULL THEN 0
        ELSE julianday(date('now')) - julianday(d.due_date)
    END AS days_overdue,
    d.status,
    d.source_type,
    d.source_id,
    d.created_at
FROM debts d
LEFT JOIN customers c ON d.party_id = c.id AND d.party_type = 'customer'
WHERE d.direction = 'receivable' 
  AND d.status NOT IN ('paid', 'written_off');

-- -----------------------------------------------------------------------------
-- View: Outstanding debts (payables)
-- Used by: Debts reporting, payment planning
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_outstanding_payables AS
SELECT 
    d.id,
    d.debt_number,
    d.party_name,
    s.phone,
    d.total_amount,
    d.amount_paid,
    d.total_amount - d.amount_paid AS amount_remaining,
    ROUND((d.total_amount - d.amount_paid) / 100.0, 2) AS amount_remaining_major,
    d.due_date,
    CASE 
        WHEN d.due_date IS NULL THEN 0
        ELSE julianday(date('now')) - julianday(d.due_date)
    END AS days_overdue,
    d.status,
    d.source_type,
    d.source_id,
    d.created_at
FROM debts d
LEFT JOIN suppliers s ON d.party_id = s.id AND d.party_type = 'supplier'
WHERE d.direction = 'payable' 
  AND d.status NOT IN ('paid', 'written_off');

-- Record migration
INSERT INTO schema_versions (version, description) 
VALUES ('007', 'Views - reporting and common queries');
