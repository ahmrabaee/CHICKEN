-- =============================================================================
-- Seed 003: Chart of Accounts
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Standard chart of accounts per PRD Section 6.1
-- Idempotent: Uses INSERT OR IGNORE
-- =============================================================================

-- =============================================================================
-- ASSETS (1xxx)
-- =============================================================================
INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1000', 'الأصول', 'Assets', 'asset', NULL, 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1100', 'الأصول المتداولة', 'Current Assets', 'asset', '1000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1110', 'النقدية', 'Cash', 'asset', '1100', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1111', 'الصندوق', 'Cash on Hand', 'asset', '1110', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1120', 'البنك', 'Bank Account', 'asset', '1100', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1130', 'المدينون', 'Accounts Receivable', 'asset', '1100', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1200', 'المخزون', 'Inventory', 'asset', '1000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1210', 'مخزون الدجاج الطازج', 'Fresh Chicken Inventory', 'asset', '1200', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1220', 'مخزون الدجاج المجمد', 'Frozen Chicken Inventory', 'asset', '1200', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1300', 'الأصول الثابتة', 'Fixed Assets', 'asset', '1000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1310', 'المعدات', 'Equipment', 'asset', '1300', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('1320', 'الأثاث والتجهيزات', 'Furniture & Fixtures', 'asset', '1300', 0);

-- =============================================================================
-- LIABILITIES (2xxx)
-- =============================================================================
INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('2000', 'الخصوم', 'Liabilities', 'liability', NULL, 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('2100', 'الخصوم المتداولة', 'Current Liabilities', 'liability', '2000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('2110', 'الدائنون', 'Accounts Payable', 'liability', '2100', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('2120', 'ضريبة القيمة المضافة المستحقة', 'VAT Payable', 'liability', '2100', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('2130', 'الرواتب المستحقة', 'Salaries Payable', 'liability', '2100', 0);

-- =============================================================================
-- EQUITY (3xxx)
-- =============================================================================
INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('3000', 'حقوق الملكية', 'Equity', 'equity', NULL, 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('3100', 'رأس المال', 'Capital', 'equity', '3000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('3200', 'الأرباح المحتجزة', 'Retained Earnings', 'equity', '3000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('3300', 'أرباح العام', 'Current Year Earnings', 'equity', '3000', 1);

-- =============================================================================
-- REVENUE (4xxx)
-- =============================================================================
INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('4000', 'الإيرادات', 'Revenue', 'revenue', NULL, 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('4010', 'إيرادات المبيعات', 'Sales Revenue', 'revenue', '4000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('4015', 'مبيعات الدجاج الطازج', 'Fresh Chicken Sales', 'revenue', '4010', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('4016', 'مبيعات الدجاج المجمد', 'Frozen Chicken Sales', 'revenue', '4010', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('4020', 'إيرادات أخرى', 'Other Revenue', 'revenue', '4000', 0);

-- =============================================================================
-- EXPENSES (5xxx)
-- =============================================================================
INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5000', 'المصروفات', 'Expenses', 'expense', NULL, 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5100', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', 'expense', '5000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5200', 'مصروفات التشغيل', 'Operating Expenses', 'expense', '5000', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5210', 'الرواتب والأجور', 'Salaries & Wages', 'expense', '5200', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5220', 'الإيجار', 'Rent', 'expense', '5200', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5230', 'المرافق', 'Utilities', 'expense', '5200', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5240', 'الصيانة', 'Maintenance', 'expense', '5200', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5250', 'الهدر والتلف', 'Wastage & Spoilage', 'expense', '5200', 1);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5251', 'هدر الدجاج', 'Chicken Wastage', 'expense', '5250', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5252', 'انكماش الدجاج الحي', 'Live Bird Shrinkage', 'expense', '5250', 0);

INSERT OR IGNORE INTO accounts (code, name, name_en, account_type, parent_account_code, is_system_account) VALUES
('5290', 'مصروفات أخرى', 'Other Expenses', 'expense', '5200', 0);
