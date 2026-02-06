-- =============================================================================
-- Seed 005: Expense Categories
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Common expense categories for chicken shops
-- Idempotent: Uses INSERT OR IGNORE
-- =============================================================================

-- Operational Expenses
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code) VALUES
('OPERATIONAL', 'مصروفات تشغيلية', 'Operational Expenses', '5200');

-- Rent
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('RENT', 'إيجار المحل', 'Shop Rent', '5220', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Utilities
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('UTILITIES', 'المرافق', 'Utilities', '5230', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('ELECTRICITY', 'الكهرباء', 'Electricity', '5230', (SELECT id FROM expense_categories WHERE code = 'UTILITIES'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('WATER', 'المياه', 'Water', '5230', (SELECT id FROM expense_categories WHERE code = 'UTILITIES'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('GAS', 'الغاز', 'Gas', '5230', (SELECT id FROM expense_categories WHERE code = 'UTILITIES'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('INTERNET', 'الإنترنت', 'Internet', '5230', (SELECT id FROM expense_categories WHERE code = 'UTILITIES'));

-- Salaries
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('SALARIES', 'الرواتب والأجور', 'Salaries & Wages', '5210', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Maintenance
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('MAINTENANCE', 'الصيانة', 'Maintenance', '5240', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('EQUIPMENT_REPAIR', 'صيانة المعدات', 'Equipment Repair', '5240', (SELECT id FROM expense_categories WHERE code = 'MAINTENANCE'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('REFRIGERATION', 'صيانة التبريد', 'Refrigeration Maintenance', '5240', (SELECT id FROM expense_categories WHERE code = 'MAINTENANCE'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('CLEANING', 'التنظيف', 'Cleaning', '5240', (SELECT id FROM expense_categories WHERE code = 'MAINTENANCE'));

-- Supplies
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('SUPPLIES', 'مستلزمات', 'Supplies', '5290', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('PACKAGING', 'مواد التغليف', 'Packaging Materials', '5290', (SELECT id FROM expense_categories WHERE code = 'SUPPLIES'));

INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('OFFICE_SUPPLIES', 'لوازم مكتبية', 'Office Supplies', '5290', (SELECT id FROM expense_categories WHERE code = 'SUPPLIES'));

-- Transport
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('TRANSPORT', 'النقل والتوصيل', 'Transport & Delivery', '5290', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Insurance
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('INSURANCE', 'التأمين', 'Insurance', '5290', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Government Fees
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('GOVT_FEES', 'رسوم حكومية', 'Government Fees', '5290', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Marketing
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('MARKETING', 'التسويق والإعلان', 'Marketing & Advertising', '5290', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Banking
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code, parent_category_id) VALUES
('BANKING', 'رسوم بنكية', 'Banking Fees', '5290', (SELECT id FROM expense_categories WHERE code = 'OPERATIONAL'));

-- Miscellaneous
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code) VALUES
('MISC', 'مصروفات متنوعة', 'Miscellaneous', '5290');

-- Personal
INSERT OR IGNORE INTO expense_categories (code, name, name_en, account_code) VALUES
('PERSONAL', 'مصروفات شخصية', 'Personal Expenses', '5290');
