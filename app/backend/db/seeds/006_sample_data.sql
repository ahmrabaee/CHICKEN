-- =============================================================================
-- Seed 006: Sample Data (Optional Demo)
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Sample data for testing and demo purposes
-- WARNING: Only run in development/demo environments
-- =============================================================================

-- =============================================================================
-- Branch
-- =============================================================================
INSERT OR IGNORE INTO branches (code, name, name_en, address, phone, has_scale, is_main_branch, is_active) VALUES
('BR001', 'الفرع الرئيسي', 'Main Branch', 'شارع الملك فهد، الرياض', '+966-11-123-4567', 1, 1, 1);

-- =============================================================================
-- Default Admin User
-- Password: Admin@123 (bcrypt hashed)
-- =============================================================================
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, full_name_en, phone, employee_number, preferred_language, default_branch_id, is_active) VALUES
('admin', 'admin@chickenshop.local', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJJhN5TWqN5pYnZpF.4jUBVu', 'مدير النظام', 'System Admin', '+966-50-000-0001', 'EMP001', 'ar', 1, 1);

-- Assign admin role
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'admin' AND r.name = 'admin';

-- =============================================================================
-- Sample Cashier User
-- Password: Cashier@123 (bcrypt hashed)
-- =============================================================================
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, full_name_en, phone, employee_number, preferred_language, default_branch_id, is_active) VALUES
('cashier1', 'cashier1@chickenshop.local', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJJhN5TWqN5pYnZpF.4jUBVu', 'أحمد الكاشير', 'Ahmad Cashier', '+966-50-000-0002', 'EMP002', 'ar', 1, 1);

-- Assign cashier role
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'cashier1' AND r.name = 'cashier';

-- =============================================================================
-- Sample Items (Chicken Products)
-- Prices in minor units (1 SAR = 100 fils)
-- =============================================================================

-- Fresh Whole Chicken
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-FW-001', '6281000000001', 'فروج كامل طازج', 'Fresh Whole Chicken', c.id, 3000, 2200, 10000, 100000, 2, 'fridge', 1
FROM categories c WHERE c.code = 'FRESH_WHOLE'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-FW-001');

-- Fresh Chicken Breast
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-FP-001', '6281000000002', 'صدور دجاج طازج', 'Fresh Chicken Breast', c.id, 4500, 3500, 5000, 50000, 2, 'fridge', 1
FROM categories c WHERE c.code = 'FRESH_PARTS'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-FP-001');

-- Fresh Chicken Thighs
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-FP-002', '6281000000003', 'أفخاذ دجاج طازج', 'Fresh Chicken Thighs', c.id, 3200, 2400, 5000, 50000, 2, 'fridge', 1
FROM categories c WHERE c.code = 'FRESH_PARTS'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-FP-002');

-- Fresh Chicken Wings
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-FP-003', '6281000000004', 'أجنحة دجاج طازج', 'Fresh Chicken Wings', c.id, 2800, 2000, 3000, 30000, 2, 'fridge', 1
FROM categories c WHERE c.code = 'FRESH_PARTS'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-FP-003');

-- Fresh Chicken Liver
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-FP-004', '6281000000005', 'كبد دجاج طازج', 'Fresh Chicken Liver', c.id, 2000, 1200, 2000, 20000, 2, 'fridge', 1
FROM categories c WHERE c.code = 'FRESH_PARTS'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-FP-004');

-- Fresh Chicken Gizzards
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-FP-005', '6281000000006', 'قوانص دجاج طازج', 'Fresh Chicken Gizzards', c.id, 1800, 1000, 2000, 20000, 2, 'fridge', 1
FROM categories c WHERE c.code = 'FRESH_PARTS'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-FP-005');

-- Frozen Whole Chicken
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-ZW-001', '6281000000010', 'فروج مجمد كامل', 'Frozen Whole Chicken', c.id, 2500, 1800, 20000, 200000, 90, 'freezer', 1
FROM categories c WHERE c.code = 'FROZEN_WHOLE'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-ZW-001');

-- Frozen Chicken Breast
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-ZP-001', '6281000000011', 'صدور دجاج مجمد', 'Frozen Chicken Breast', c.id, 4000, 3000, 10000, 100000, 90, 'freezer', 1
FROM categories c WHERE c.code = 'FROZEN_PARTS'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-ZP-001');

-- Grilled Chicken (Processed)
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-PR-001', '6281000000020', 'دجاج مشوي', 'Grilled Chicken', c.id, 4000, 2800, 5000, 30000, 1, 'display', 1
FROM categories c WHERE c.code = 'PROCESSED'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-PR-001');

-- Marinated Chicken
INSERT INTO items (code, barcode, name, name_en, category_id, default_sale_price, default_purchase_price, min_stock_level_grams, max_stock_level_grams, shelf_life_days, storage_location, requires_scale)
SELECT 'CH-PR-002', '6281000000021', 'دجاج متبل', 'Marinated Chicken', c.id, 3500, 2600, 5000, 30000, 3, 'fridge', 1
FROM categories c WHERE c.code = 'PROCESSED'
AND NOT EXISTS (SELECT 1 FROM items WHERE code = 'CH-PR-002');

-- =============================================================================
-- Sample Suppliers
-- =============================================================================
INSERT OR IGNORE INTO suppliers (supplier_number, name, name_en, phone, address, contact_person, payment_terms, rating, is_active) VALUES
('S001', 'مزرعة الخير', 'Al-Khair Farm', '+966-50-111-1111', 'طريق المزارع، الرياض', 'محمد أحمد', 'Net 30', 5, 1);

INSERT OR IGNORE INTO suppliers (supplier_number, name, name_en, phone, address, contact_person, payment_terms, rating, is_active) VALUES
('S002', 'مزرعة النور', 'Al-Noor Farm', '+966-50-222-2222', 'طريق الشمال، الرياض', 'علي محمود', 'Net 15', 4, 1);

INSERT OR IGNORE INTO suppliers (supplier_number, name, name_en, phone, address, contact_person, payment_terms, rating, is_active) VALUES
('S003', 'شركة الدواجن العربية', 'Arabian Poultry Co.', '+966-50-333-3333', 'المنطقة الصناعية، الدمام', 'خالد سالم', 'Cash on Delivery', 4, 1);

-- =============================================================================
-- Sample Customers
-- =============================================================================
INSERT OR IGNORE INTO customers (customer_number, name, name_en, phone, address, credit_limit, price_level, is_active) VALUES
('C001', 'علي محمد', 'Ali Mohammed', '+966-50-444-4444', 'حي الورود، الرياض', 500000, 'standard', 1);

INSERT OR IGNORE INTO customers (customer_number, name, name_en, phone, address, credit_limit, price_level, is_active) VALUES
('C002', 'مطعم الفرسان', 'Al-Fursan Restaurant', '+966-11-555-5555', 'شارع التحلية، الرياض', 2000000, 'wholesale', 1);

INSERT OR IGNORE INTO customers (customer_number, name, name_en, phone, address, credit_limit, price_level, is_active) VALUES
('C003', 'فندق النخيل', 'Al-Nakheel Hotel', '+966-11-666-6666', 'طريق الملك فهد، الرياض', 5000000, 'vip', 1);

-- =============================================================================
-- Sample Inventory Lots
-- For testing FIFO, add multiple lots for fresh chicken
-- =============================================================================

-- Lot 1: Fresh Whole Chicken from 3 days ago
INSERT INTO inventory_lots (item_id, lot_number, batch_number, total_quantity_grams, remaining_quantity_grams, unit_purchase_price, received_at, expiry_date, branch_id)
SELECT i.id, 'LOT-20260203-0001', 'BATCH-001', 25000, 18000, 2200, 
       datetime('now', '-3 days'), date('now', '-1 days'), 1
FROM items i WHERE i.code = 'CH-FW-001'
AND NOT EXISTS (SELECT 1 FROM inventory_lots WHERE lot_number = 'LOT-20260203-0001');

-- Lot 2: Fresh Whole Chicken from 2 days ago
INSERT INTO inventory_lots (item_id, lot_number, batch_number, total_quantity_grams, remaining_quantity_grams, unit_purchase_price, received_at, expiry_date, branch_id)
SELECT i.id, 'LOT-20260204-0001', 'BATCH-002', 30000, 30000, 2250, 
       datetime('now', '-2 days'), date('now'), 1
FROM items i WHERE i.code = 'CH-FW-001'
AND NOT EXISTS (SELECT 1 FROM inventory_lots WHERE lot_number = 'LOT-20260204-0001');

-- Lot 3: Fresh Whole Chicken from today
INSERT INTO inventory_lots (item_id, lot_number, batch_number, total_quantity_grams, remaining_quantity_grams, unit_purchase_price, received_at, expiry_date, branch_id)
SELECT i.id, 'LOT-20260206-0001', 'BATCH-003', 40000, 40000, 2300, 
       datetime('now'), date('now', '+2 days'), 1
FROM items i WHERE i.code = 'CH-FW-001'
AND NOT EXISTS (SELECT 1 FROM inventory_lots WHERE lot_number = 'LOT-20260206-0001');

-- Update inventory for Fresh Whole Chicken
UPDATE inventory SET 
    current_quantity_grams = (SELECT SUM(remaining_quantity_grams) FROM inventory_lots WHERE item_id = inventory.item_id),
    total_value = (SELECT SUM(remaining_quantity_grams * unit_purchase_price / 1000) FROM inventory_lots WHERE item_id = inventory.item_id),
    last_restocked_at = datetime('now')
WHERE item_id = (SELECT id FROM items WHERE code = 'CH-FW-001');

-- Lot for Chicken Breast
INSERT INTO inventory_lots (item_id, lot_number, batch_number, total_quantity_grams, remaining_quantity_grams, unit_purchase_price, received_at, expiry_date, branch_id)
SELECT i.id, 'LOT-20260206-0002', 'BATCH-003', 15000, 15000, 3500, 
       datetime('now'), date('now', '+2 days'), 1
FROM items i WHERE i.code = 'CH-FP-001'
AND NOT EXISTS (SELECT 1 FROM inventory_lots WHERE lot_number = 'LOT-20260206-0002');

-- Update inventory for Chicken Breast
UPDATE inventory SET 
    current_quantity_grams = (SELECT COALESCE(SUM(remaining_quantity_grams), 0) FROM inventory_lots WHERE item_id = inventory.item_id),
    total_value = (SELECT COALESCE(SUM(remaining_quantity_grams * unit_purchase_price / 1000), 0) FROM inventory_lots WHERE item_id = inventory.item_id),
    last_restocked_at = datetime('now')
WHERE item_id = (SELECT id FROM items WHERE code = 'CH-FP-001');

-- Lot for Frozen Whole Chicken
INSERT INTO inventory_lots (item_id, lot_number, batch_number, total_quantity_grams, remaining_quantity_grams, unit_purchase_price, received_at, expiry_date, branch_id)
SELECT i.id, 'LOT-20260201-0001', 'BATCH-F01', 100000, 85000, 1800, 
       datetime('now', '-5 days'), date('now', '+85 days'), 1
FROM items i WHERE i.code = 'CH-ZW-001'
AND NOT EXISTS (SELECT 1 FROM inventory_lots WHERE lot_number = 'LOT-20260201-0001');

-- Update inventory for Frozen Whole Chicken
UPDATE inventory SET 
    current_quantity_grams = (SELECT COALESCE(SUM(remaining_quantity_grams), 0) FROM inventory_lots WHERE item_id = inventory.item_id),
    total_value = (SELECT COALESCE(SUM(remaining_quantity_grams * unit_purchase_price / 1000), 0) FROM inventory_lots WHERE item_id = inventory.item_id),
    last_restocked_at = datetime('now', '-5 days')
WHERE item_id = (SELECT id FROM items WHERE code = 'CH-ZW-001');
