-- =============================================================================
-- Example Queries
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Contains 15+ example queries aligned with PRD workflows
-- Each query notes which indexes it benefits from
-- =============================================================================

-- =============================================================================
-- 1. ITEM SEARCH & LISTING
-- =============================================================================

-- 1.1 Search items by name or barcode (Arabic/English)
-- Index benefits: idx_items_barcode, idx_items_name, idx_items_name_en
-- Use case: POS scanning/search, Inventory lookup
SELECT 
    i.id,
    i.code,
    i.barcode,
    i.name,
    i.name_en,
    c.name AS category_name,
    i.default_sale_price,
    i.shelf_life_days,
    inv.current_quantity_grams / 1000.0 AS current_stock_kg
FROM items i
JOIN categories c ON i.category_id = c.id
LEFT JOIN inventory inv ON i.id = inv.item_id
WHERE i.is_active = 1
  AND (
      i.barcode = :search_term
      OR i.name LIKE '%' || :search_term || '%'
      OR i.name_en LIKE '%' || :search_term || '%'
      OR i.code LIKE '%' || :search_term || '%'
  )
ORDER BY i.name
LIMIT :page_size OFFSET (:page - 1) * :page_size;

-- 1.2 List items with pagination and category filter
-- Index benefits: idx_items_category, idx_items_is_active
-- Use case: Inventory management screen
SELECT 
    i.id,
    i.code,
    i.name,
    c.name AS category_name,
    i.default_sale_price / 100.0 AS price_sar,
    inv.current_quantity_grams / 1000.0 AS stock_kg,
    CASE 
        WHEN inv.current_quantity_grams < i.min_stock_level_grams THEN 'low'
        WHEN inv.current_quantity_grams > i.max_stock_level_grams THEN 'high'
        ELSE 'normal'
    END AS stock_status
FROM items i
JOIN categories c ON i.category_id = c.id
LEFT JOIN inventory inv ON i.id = inv.item_id
WHERE i.is_active = 1
  AND (:category_id IS NULL OR i.category_id = :category_id)
ORDER BY c.sort_order, i.name
LIMIT 20 OFFSET :offset;


-- =============================================================================
-- 2. POS SALE WORKFLOW
-- =============================================================================

-- 2.1 Get available lots for an item (FIFO order)
-- Index benefits: idx_lots_item_remaining, idx_lots_expiry
-- Use case: POS sale to determine which lots to deplete
SELECT 
    il.id AS lot_id,
    il.lot_number,
    il.remaining_quantity_grams / 1000.0 AS available_kg,
    il.unit_purchase_price / 100.0 AS cost_per_kg_sar,
    il.expiry_date,
    julianday(il.expiry_date) - julianday('now') AS days_until_expiry
FROM inventory_lots il
WHERE il.item_id = :item_id
  AND il.remaining_quantity_grams > 0
  AND il.is_depleted = 0
ORDER BY il.received_at ASC, il.id ASC;  -- FIFO

-- 2.2 Create a complete POS sale with FIFO allocation
-- This is a transaction that should be wrapped in BEGIN/COMMIT

-- Step 1: Create the sale header
INSERT INTO sales (invoice_number, branch_id, user_id, customer_id, sale_type, payment_method, total_amount, tax_amount, discount_amount, net_amount, status)
VALUES (:invoice_number, :branch_id, :user_id, :customer_id, 'pos', :payment_method, :total_amount, :tax_amount, :discount_amount, :net_amount, 'completed');

-- Step 2: Insert sale line (one per item)
INSERT INTO sale_lines (sale_id, item_id, quantity_grams, unit_price, line_total, cost_of_goods)
VALUES (last_insert_rowid(), :item_id, :quantity_grams, :unit_price, :line_total, :calculated_cost);

-- Step 3: Record cost allocation from specific lots (FIFO)
-- Repeat this for each lot consumed
INSERT INTO sale_line_cost_allocations (sale_line_id, lot_id, quantity_grams, unit_cost)
VALUES (:sale_line_id, :lot_id, :allocated_grams, :lot_unit_cost);

-- Step 4: Reduce lot remaining quantity
UPDATE inventory_lots 
SET remaining_quantity_grams = remaining_quantity_grams - :allocated_grams,
    is_depleted = CASE WHEN remaining_quantity_grams - :allocated_grams <= 0 THEN 1 ELSE 0 END
WHERE id = :lot_id;

-- Step 5: Update inventory summary
UPDATE inventory 
SET current_quantity_grams = current_quantity_grams - :total_quantity_sold,
    total_value = (SELECT SUM(remaining_quantity_grams * unit_purchase_price / 1000) 
                   FROM inventory_lots WHERE item_id = :item_id AND is_depleted = 0)
WHERE item_id = :item_id;


-- =============================================================================
-- 3. PURCHASE RECEIVING (LIVE BIRD)
-- =============================================================================

-- 3.1 Create purchase with live bird shrinkage calculation
-- Live weight: 100kg, Dead weight after slaughter: 70kg → 30% shrinkage

-- Step 1: Create purchase header
INSERT INTO purchases (purchase_number, supplier_id, branch_id, user_id, purchase_type, gross_weight_grams, net_weight_grams, shrinkage_grams, shrinkage_percentage, total_amount, status)
VALUES (
    :purchase_number, 
    :supplier_id, 
    :branch_id, 
    :user_id, 
    'live_bird',
    :gross_weight_grams,  -- e.g., 100000 (100kg live)
    :net_weight_grams,    -- e.g., 70000 (70kg dressed)
    :shrinkage_grams,     -- e.g., 30000 (30kg lost)
    :shrinkage_pct,       -- e.g., 3000 (30% in basis points)
    :total_amount,
    'received'
);

-- Step 2: Insert purchase line
INSERT INTO purchase_lines (purchase_id, item_id, quantity_grams, unit_price, line_total)
VALUES (last_insert_rowid(), :item_id, :net_weight_grams, :unit_price, :line_total);

-- Step 3: Create new inventory lot
INSERT INTO inventory_lots (item_id, lot_number, batch_number, total_quantity_grams, remaining_quantity_grams, unit_purchase_price, received_at, expiry_date, supplier_id, purchase_id, branch_id)
VALUES (
    :item_id,
    :lot_number,
    :batch_number,
    :net_weight_grams,
    :net_weight_grams,
    :unit_purchase_price,
    datetime('now'),
    date('now', '+' || (SELECT shelf_life_days FROM items WHERE id = :item_id) || ' days'),
    :supplier_id,
    :purchase_id,
    :branch_id
);

-- Step 4: Update inventory
UPDATE inventory 
SET current_quantity_grams = current_quantity_grams + :net_weight_grams,
    total_value = total_value + (:net_weight_grams * :unit_purchase_price / 1000),
    last_restocked_at = datetime('now')
WHERE item_id = :item_id;


-- =============================================================================
-- 4. WASTAGE RECORDING
-- =============================================================================

-- 4.1 Record wastage and reduce specific lot (FIFO)
-- Index benefits: idx_wastage_item, idx_wastage_date
INSERT INTO wastage_records (item_id, lot_id, wastage_type, quantity_grams, cost_value, reason, recorded_by, branch_id)
VALUES (:item_id, :lot_id, :wastage_type, :quantity_grams, :cost_value, :reason, :user_id, :branch_id);

-- Reduce lot
UPDATE inventory_lots 
SET remaining_quantity_grams = remaining_quantity_grams - :quantity_grams,
    is_depleted = CASE WHEN remaining_quantity_grams - :quantity_grams <= 0 THEN 1 ELSE 0 END
WHERE id = :lot_id;

-- Update inventory
UPDATE inventory 
SET current_quantity_grams = current_quantity_grams - :quantity_grams,
    total_value = total_value - :cost_value
WHERE item_id = :item_id;


-- =============================================================================
-- 5. CUSTOMER & SUPPLIER MANAGEMENT
-- =============================================================================

-- 5.1 Customer list with balance (accounts receivable)
-- Index benefits: idx_customers_phone, idx_sales_customer
-- Use case: Customer lookup, Credit management
SELECT 
    c.id,
    c.customer_number,
    c.name,
    c.phone,
    c.credit_limit / 100.0 AS credit_limit_sar,
    COALESCE(SUM(CASE WHEN s.payment_method = 'credit' AND s.is_voided = 0 THEN s.net_amount ELSE 0 END), 0) / 100.0 AS total_credit_sales_sar,
    COALESCE(SUM(CASE WHEN p.party_type = 'customer' AND p.party_id = c.id THEN p.amount ELSE 0 END), 0) / 100.0 AS total_payments_sar
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
LEFT JOIN payments p ON p.party_type = 'customer' AND p.party_id = c.id
WHERE c.is_active = 1
GROUP BY c.id
ORDER BY c.name;

-- 5.2 Customer balance view (using the pre-built view)
SELECT * FROM v_customer_balances WHERE balance_minor > 0;

-- 5.3 Supplier list with outstanding payables
-- Index benefits: idx_suppliers_is_active
SELECT 
    s.id,
    s.supplier_number,
    s.name,
    s.phone,
    s.rating,
    COALESCE(balance.outstanding, 0) / 100.0 AS outstanding_sar
FROM suppliers s
LEFT JOIN (
    SELECT 
        p.supplier_id,
        SUM(p.total_amount) - COALESCE(SUM(pay.amount), 0) AS outstanding
    FROM purchases p
    LEFT JOIN payments pay ON pay.party_type = 'supplier' AND pay.party_id = p.supplier_id
    WHERE p.is_voided = 0
    GROUP BY p.supplier_id
) balance ON s.id = balance.supplier_id
WHERE s.is_active = 1
ORDER BY s.name;


-- =============================================================================
-- 6. DEBT TRACKING
-- =============================================================================

-- 6.1 Outstanding customer debts (accounts receivable aging)
-- Index benefits: idx_debts_party, idx_debts_status, idx_debts_due_date
SELECT 
    d.id,
    c.name AS customer_name,
    c.phone,
    d.original_amount / 100.0 AS original_sar,
    d.remaining_amount / 100.0 AS remaining_sar,
    d.due_date,
    CASE 
        WHEN d.due_date < date('now') THEN julianday('now') - julianday(d.due_date)
        ELSE 0
    END AS days_overdue,
    CASE 
        WHEN d.due_date < date('now', '-90 days') THEN 'critical'
        WHEN d.due_date < date('now', '-60 days') THEN 'high'
        WHEN d.due_date < date('now', '-30 days') THEN 'medium'
        WHEN d.due_date < date('now') THEN 'low'
        ELSE 'current'
    END AS aging_bucket
FROM debts d
JOIN customers c ON d.party_type = 'customer' AND d.party_id = c.id
WHERE d.party_type = 'customer'
  AND d.status = 'active'
  AND d.remaining_amount > 0
ORDER BY d.due_date ASC;

-- 6.2 Record payment against debt
INSERT INTO payments (payment_number, party_type, party_id, payment_method, amount, reference, notes, received_by, branch_id)
VALUES (:payment_number, 'customer', :customer_id, :payment_method, :amount, :reference, :notes, :user_id, :branch_id);

-- Update debt
UPDATE debts 
SET remaining_amount = remaining_amount - :amount,
    last_payment_date = date('now'),
    status = CASE WHEN remaining_amount - :amount <= 0 THEN 'paid' ELSE 'active' END
WHERE id = :debt_id;


-- =============================================================================
-- 7. EXPENSE RECORDING
-- =============================================================================

-- 7.1 Record an expense with journal entry (double-entry)
-- Step 1: Create expense
INSERT INTO expenses (expense_number, category_id, amount, description, expense_date, payment_method, vendor_name, receipt_number, recorded_by, branch_id)
VALUES (:expense_number, :category_id, :amount, :description, :expense_date, :payment_method, :vendor_name, :receipt_number, :user_id, :branch_id);

-- Step 2: Create journal entry
INSERT INTO journal_entries (entry_number, entry_type, description, total_amount, created_by, branch_id)
VALUES (:entry_number, 'expense', :description, :amount, :user_id, :branch_id);

-- Step 3: Debit expense account
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
SELECT last_insert_rowid(), a.id, :amount, 0, :description
FROM accounts a WHERE a.account_number = :expense_account_number;

-- Step 4: Credit cash/bank account
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
SELECT 
    (SELECT MAX(id) FROM journal_entries), 
    a.id, 
    0, 
    :amount, 
    :description
FROM accounts a WHERE a.account_number = :payment_account_number;


-- =============================================================================
-- 8. REPORTING QUERIES
-- =============================================================================

-- 8.1 Daily Sales Summary
-- Index benefits: idx_sales_date, idx_sales_branch
-- Use case: End-of-day reconciliation
SELECT 
    date(s.sale_date) AS sale_date,
    COUNT(*) AS total_transactions,
    SUM(CASE WHEN s.payment_method = 'cash' THEN 1 ELSE 0 END) AS cash_transactions,
    SUM(CASE WHEN s.payment_method = 'credit' THEN 1 ELSE 0 END) AS credit_transactions,
    SUM(s.total_amount) / 100.0 AS total_sales_sar,
    SUM(s.discount_amount) / 100.0 AS total_discounts_sar,
    SUM(s.tax_amount) / 100.0 AS total_tax_sar,
    SUM(s.net_amount) / 100.0 AS net_sales_sar,
    SUM(sl.cost_of_goods) / 100.0 AS cost_of_goods_sar,
    (SUM(s.net_amount) - SUM(sl.cost_of_goods)) / 100.0 AS gross_profit_sar,
    CASE 
        WHEN SUM(s.net_amount) > 0 
        THEN ROUND((SUM(s.net_amount) - SUM(sl.cost_of_goods)) * 100.0 / SUM(s.net_amount), 2)
        ELSE 0 
    END AS gross_margin_pct
FROM sales s
LEFT JOIN sale_lines sl ON s.id = sl.sale_id
WHERE s.is_voided = 0
  AND date(s.sale_date) = :report_date
  AND s.branch_id = :branch_id
GROUP BY date(s.sale_date);

-- 8.2 Item Sales Report (Top sellers)
-- Index benefits: idx_sale_lines_item
SELECT 
    i.code,
    i.name,
    c.name AS category,
    SUM(sl.quantity_grams) / 1000.0 AS total_sold_kg,
    SUM(sl.line_total) / 100.0 AS total_revenue_sar,
    SUM(sl.cost_of_goods) / 100.0 AS total_cost_sar,
    (SUM(sl.line_total) - SUM(sl.cost_of_goods)) / 100.0 AS gross_profit_sar,
    COUNT(DISTINCT s.id) AS transaction_count
FROM sale_lines sl
JOIN sales s ON sl.sale_id = s.id
JOIN items i ON sl.item_id = i.id
JOIN categories c ON i.category_id = c.id
WHERE s.is_voided = 0
  AND s.sale_date BETWEEN :start_date AND :end_date
GROUP BY i.id
ORDER BY SUM(sl.line_total) DESC
LIMIT 20;

-- 8.3 Inventory Valuation Report
-- Index benefits: Uses v_item_inventory view
SELECT 
    i.code,
    i.name,
    c.name AS category,
    inv.current_quantity_grams / 1000.0 AS quantity_kg,
    inv.total_value / 100.0 AS value_sar,
    CASE 
        WHEN inv.current_quantity_grams > 0 
        THEN (inv.total_value * 1000.0) / inv.current_quantity_grams / 100.0
        ELSE 0 
    END AS avg_cost_per_kg_sar,
    i.default_sale_price / 100.0 AS sale_price_per_kg_sar,
    CASE 
        WHEN inv.current_quantity_grams < i.min_stock_level_grams THEN 'LOW'
        WHEN inv.current_quantity_grams > i.max_stock_level_grams THEN 'EXCESS'
        ELSE 'OK'
    END AS stock_status
FROM inventory inv
JOIN items i ON inv.item_id = i.id
JOIN categories c ON i.category_id = c.id
WHERE i.is_active = 1
ORDER BY c.sort_order, i.name;

-- 8.4 Purchase Summary by Supplier
-- Index benefits: idx_purchases_supplier, idx_purchases_date
SELECT 
    s.supplier_number,
    s.name AS supplier_name,
    COUNT(p.id) AS total_purchases,
    SUM(p.gross_weight_grams) / 1000.0 AS total_gross_kg,
    SUM(p.net_weight_grams) / 1000.0 AS total_net_kg,
    SUM(p.shrinkage_grams) / 1000.0 AS total_shrinkage_kg,
    CASE 
        WHEN SUM(p.gross_weight_grams) > 0 
        THEN ROUND(SUM(p.shrinkage_grams) * 100.0 / SUM(p.gross_weight_grams), 2)
        ELSE 0 
    END AS avg_shrinkage_pct,
    SUM(p.total_amount) / 100.0 AS total_amount_sar
FROM suppliers s
LEFT JOIN purchases p ON s.id = p.supplier_id AND p.is_voided = 0
WHERE s.is_active = 1
  AND (:start_date IS NULL OR p.purchase_date >= :start_date)
  AND (:end_date IS NULL OR p.purchase_date <= :end_date)
GROUP BY s.id
ORDER BY SUM(p.total_amount) DESC;

-- 8.5 Wastage Report
-- Index benefits: idx_wastage_item, idx_wastage_date
SELECT 
    date(w.recorded_at) AS wastage_date,
    i.name AS item_name,
    w.wastage_type,
    w.quantity_grams / 1000.0 AS quantity_kg,
    w.cost_value / 100.0 AS cost_sar,
    w.reason,
    u.full_name AS recorded_by
FROM wastage_records w
JOIN items i ON w.item_id = i.id
JOIN users u ON w.recorded_by = u.id
WHERE w.recorded_at BETWEEN :start_date AND :end_date
  AND w.is_voided = 0
ORDER BY w.recorded_at DESC;

-- 8.6 Cash Flow Summary (Daily)
SELECT 
    date('now') AS report_date,
    -- Cash from sales
    (SELECT COALESCE(SUM(net_amount), 0) FROM sales 
     WHERE payment_method = 'cash' AND is_voided = 0 AND date(sale_date) = date('now')) AS cash_sales,
    -- Cash payments received
    (SELECT COALESCE(SUM(amount), 0) FROM payments 
     WHERE payment_method = 'cash' AND date(payment_date) = date('now')) AS cash_received,
    -- Cash expenses
    (SELECT COALESCE(SUM(amount), 0) FROM expenses 
     WHERE payment_method = 'cash' AND date(expense_date) = date('now')) AS cash_expenses,
    -- Cash paid to suppliers
    (SELECT COALESCE(SUM(amount), 0) FROM payments 
     WHERE party_type = 'supplier' AND payment_method = 'cash' AND date(payment_date) = date('now')) AS cash_paid,
    -- Net cash flow
    (
        (SELECT COALESCE(SUM(net_amount), 0) FROM sales WHERE payment_method = 'cash' AND is_voided = 0 AND date(sale_date) = date('now'))
        + (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE party_type = 'customer' AND payment_method = 'cash' AND date(payment_date) = date('now'))
        - (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE payment_method = 'cash' AND date(expense_date) = date('now'))
        - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE party_type = 'supplier' AND payment_method = 'cash' AND date(payment_date) = date('now'))
    ) AS net_cash_flow;


-- =============================================================================
-- 9. EXPIRING INVENTORY ALERTS
-- =============================================================================

-- 9.1 Items expiring in next N days
-- Index benefits: idx_lots_expiry
SELECT 
    i.code,
    i.name,
    il.lot_number,
    il.remaining_quantity_grams / 1000.0 AS quantity_kg,
    il.expiry_date,
    julianday(il.expiry_date) - julianday('now') AS days_until_expiry,
    CASE 
        WHEN il.expiry_date <= date('now') THEN 'expired'
        WHEN il.expiry_date <= date('now', '+1 day') THEN 'expires_today_or_tomorrow'
        WHEN il.expiry_date <= date('now', '+3 days') THEN 'expires_soon'
        ELSE 'ok'
    END AS status
FROM inventory_lots il
JOIN items i ON il.item_id = i.id
WHERE il.is_depleted = 0
  AND il.remaining_quantity_grams > 0
  AND il.expiry_date <= date('now', '+' || :alert_days || ' days')
ORDER BY il.expiry_date ASC;


-- =============================================================================
-- 10. AUDIT & SECURITY
-- =============================================================================

-- 10.1 User activity log
-- Index benefits: idx_audit_table_record, idx_audit_performed_at
SELECT 
    al.id,
    al.action,
    al.table_name,
    al.record_id,
    u.username,
    u.full_name,
    al.old_values,
    al.new_values,
    al.ip_address,
    al.performed_at
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE (:table_name IS NULL OR al.table_name = :table_name)
  AND (:user_id IS NULL OR al.user_id = :user_id)
  AND al.performed_at BETWEEN :start_date AND :end_date
ORDER BY al.performed_at DESC
LIMIT 100;

-- 10.2 Voided transactions report
SELECT 
    'sale' AS transaction_type,
    s.invoice_number AS reference,
    s.net_amount / 100.0 AS amount_sar,
    s.voided_at,
    s.voided_reason,
    v.full_name AS voided_by
FROM sales s
JOIN users v ON s.voided_by = v.id
WHERE s.is_voided = 1
  AND date(s.voided_at) BETWEEN :start_date AND :end_date

UNION ALL

SELECT 
    'purchase' AS transaction_type,
    p.purchase_number AS reference,
    p.total_amount / 100.0 AS amount_sar,
    p.voided_at,
    p.voided_reason,
    v.full_name AS voided_by
FROM purchases p
JOIN users v ON p.voided_by = v.id
WHERE p.is_voided = 1
  AND date(p.voided_at) BETWEEN :start_date AND :end_date

ORDER BY voided_at DESC;


-- =============================================================================
-- 11. LOW STOCK ALERTS
-- =============================================================================

-- 11.1 Items below minimum stock
-- Uses v_low_stock_items view
SELECT 
    code,
    name,
    category,
    current_kg,
    min_level_kg,
    shortage_kg
FROM v_low_stock_items
ORDER BY shortage_kg DESC;


-- =============================================================================
-- 12. PROFIT & LOSS (MONTHLY)
-- =============================================================================

-- 12.1 Monthly P&L Statement
WITH monthly_sales AS (
    SELECT 
        strftime('%Y-%m', sale_date) AS month,
        SUM(net_amount) AS revenue,
        SUM(sl.cost_of_goods) AS cogs
    FROM sales s
    JOIN sale_lines sl ON s.id = sl.sale_id
    WHERE s.is_voided = 0
      AND strftime('%Y-%m', sale_date) = :month
    GROUP BY strftime('%Y-%m', sale_date)
),
monthly_expenses AS (
    SELECT 
        strftime('%Y-%m', expense_date) AS month,
        SUM(amount) AS total_expenses
    FROM expenses
    WHERE is_voided = 0
      AND strftime('%Y-%m', expense_date) = :month
    GROUP BY strftime('%Y-%m', expense_date)
)
SELECT 
    COALESCE(ms.month, me.month) AS month,
    COALESCE(ms.revenue, 0) / 100.0 AS revenue_sar,
    COALESCE(ms.cogs, 0) / 100.0 AS cost_of_goods_sar,
    (COALESCE(ms.revenue, 0) - COALESCE(ms.cogs, 0)) / 100.0 AS gross_profit_sar,
    COALESCE(me.total_expenses, 0) / 100.0 AS operating_expenses_sar,
    (COALESCE(ms.revenue, 0) - COALESCE(ms.cogs, 0) - COALESCE(me.total_expenses, 0)) / 100.0 AS net_profit_sar,
    CASE 
        WHEN COALESCE(ms.revenue, 0) > 0 
        THEN ROUND((COALESCE(ms.revenue, 0) - COALESCE(ms.cogs, 0) - COALESCE(me.total_expenses, 0)) * 100.0 / ms.revenue, 2)
        ELSE 0 
    END AS net_margin_pct
FROM monthly_sales ms
FULL OUTER JOIN monthly_expenses me ON ms.month = me.month;


-- =============================================================================
-- 13. SCALE INTEGRATION HELPERS
-- =============================================================================

-- 13.1 Get item by barcode for scale integration
-- Index benefits: idx_items_barcode
-- Use case: Scale reads barcode, returns item with current price
SELECT 
    i.id,
    i.code,
    i.barcode,
    i.name,
    i.name_en,
    i.default_sale_price,
    i.requires_scale,
    c.shelf_life_days
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.barcode = :barcode
  AND i.is_active = 1;


-- =============================================================================
-- 14. CLOSING BALANCE CALCULATION
-- =============================================================================

-- 14.1 Calculate cash drawer balance for shift closing
SELECT 
    -- Opening balance (from settings or parameter)
    :opening_balance AS opening_balance_sar,
    
    -- Cash sales
    COALESCE((
        SELECT SUM(net_amount) 
        FROM sales 
        WHERE payment_method = 'cash' 
          AND is_voided = 0 
          AND user_id = :user_id
          AND sale_date BETWEEN :shift_start AND :shift_end
    ), 0) / 100.0 AS cash_sales_sar,
    
    -- Cash received from customers
    COALESCE((
        SELECT SUM(amount) 
        FROM payments 
        WHERE payment_method = 'cash' 
          AND party_type = 'customer'
          AND received_by = :user_id
          AND payment_date BETWEEN :shift_start AND :shift_end
    ), 0) / 100.0 AS cash_received_sar,
    
    -- Cash refunds
    COALESCE((
        SELECT SUM(net_amount) 
        FROM sales 
        WHERE sale_type = 'return' 
          AND payment_method = 'cash' 
          AND is_voided = 0 
          AND user_id = :user_id
          AND sale_date BETWEEN :shift_start AND :shift_end
    ), 0) / 100.0 AS cash_refunds_sar,
    
    -- Expected closing
    (
        :opening_balance 
        + COALESCE((SELECT SUM(net_amount) FROM sales WHERE payment_method = 'cash' AND is_voided = 0 AND user_id = :user_id AND sale_date BETWEEN :shift_start AND :shift_end), 0)
        + COALESCE((SELECT SUM(amount) FROM payments WHERE payment_method = 'cash' AND party_type = 'customer' AND received_by = :user_id AND payment_date BETWEEN :shift_start AND :shift_end), 0)
        - COALESCE((SELECT SUM(net_amount) FROM sales WHERE sale_type = 'return' AND payment_method = 'cash' AND is_voided = 0 AND user_id = :user_id AND sale_date BETWEEN :shift_start AND :shift_end), 0)
    ) / 100.0 AS expected_closing_sar;


-- =============================================================================
-- 15. TRIAL BALANCE
-- =============================================================================

-- 15.1 Generate trial balance from journal entries
SELECT 
    a.account_number,
    a.name AS account_name,
    at.name AS account_type,
    SUM(jel.debit_amount) / 100.0 AS total_debits_sar,
    SUM(jel.credit_amount) / 100.0 AS total_credits_sar,
    (SUM(jel.debit_amount) - SUM(jel.credit_amount)) / 100.0 AS balance_sar
FROM accounts a
JOIN accounts at ON a.account_type_id = at.id
LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = 1
WHERE a.is_active = 1
GROUP BY a.id
HAVING SUM(jel.debit_amount) != 0 OR SUM(jel.credit_amount) != 0
ORDER BY a.account_number;
