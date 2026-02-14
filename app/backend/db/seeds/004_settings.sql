-- =============================================================================
-- Seed 004: System Settings
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Default system configuration per PRD Section 2.1
-- Idempotent: Uses INSERT OR IGNORE
-- =============================================================================

-- =============================================================================
-- General Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('BusinessName', 'الفروج الذهبي', 'Business name (Arabic)', 'string', 'general', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('BusinessNameEn', 'Golden Chicken', 'Business name (English)', 'string', 'general', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('BusinessAddress', '', 'Business address', 'string', 'general', 0);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('BusinessPhone', '', 'Business phone number', 'string', 'general', 0);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('Logo', '', 'Business logo (Base64 or URL)', 'string', 'general', 0);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('Language', 'ar', 'Default UI language (ar/en)', 'string', 'general', 1);

-- =============================================================================
-- Currency Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('Currency', 'SAR', 'Currency code (ISO 4217)', 'string', 'currency', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('CurrencySymbol', 'ر.س', 'Currency symbol for display', 'string', 'currency', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('CurrencyDecimals', '2', 'Decimal places for currency', 'number', 'currency', 1);

-- =============================================================================
-- Tax Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('TaxEnabled', 'true', 'Enable VAT/tax calculations', 'boolean', 'tax', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('TaxRate', '1500', 'Default tax rate in basis points (1500 = 15%)', 'number', 'tax', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('TaxLabel', 'ضريبة القيمة المضافة', 'Tax display label', 'string', 'tax', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('TaxNumber', '', 'Business tax registration number', 'string', 'tax', 0);

-- =============================================================================
-- Inventory Settings (Chicken-specific)
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('WeightUnit', 'kg', 'Primary weight unit (fixed for chicken shop)', 'string', 'inventory', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('InventoryMethod', 'FIFO', 'Inventory costing method (fixed)', 'string', 'inventory', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('AllowNegativeStock', 'false', 'Allow sales when stock insufficient', 'boolean', 'inventory', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('FreshChickenShelfLife', '2', 'Fresh chicken shelf life in days', 'number', 'inventory', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('FrozenChickenShelfLife', '90', 'Frozen chicken shelf life in days', 'number', 'inventory', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('DefaultShrinkagePercentage', '2500', 'Default live bird shrinkage in basis points (2500 = 25%)', 'number', 'inventory', 1);

-- =============================================================================
-- Numbering Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('SaleNumberPrefix', 'SAL-', 'Sales invoice number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('PurchaseNumberPrefix', 'PUR-', 'Purchase order number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('PaymentNumberPrefix', 'PAY-', 'Payment number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('DebtNumberPrefix', 'DEB-', 'Debt number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ExpenseNumberPrefix', 'EXP-', 'Expense number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('JournalEntryPrefix', 'JE-', 'Journal entry number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('CustomerNumberPrefix', 'C', 'Customer number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('SupplierNumberPrefix', 'S', 'Supplier number prefix', 'string', 'numbering', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('LotNumberPrefix', 'LOT-', 'Lot number prefix', 'string', 'numbering', 1);

-- =============================================================================
-- Scale Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleComPort', 'COM3', 'Serial port for digital scale', 'string', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleBaudRate', '9600', 'Baud rate for scale communication', 'number', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleAutoRead', 'true', 'Enable automatic weight reading', 'boolean', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleAutoReadInterval', '200', 'Auto-read poll interval in ms', 'number', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleStabilityThreshold', '10', 'Stability threshold in grams', 'number', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleStabilityDuration', '2000', 'Stability duration in ms', 'number', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('ScaleMinimumWeight', '50', 'Minimum weight reading in grams', 'number', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('RequireScaleReading', 'true', 'Require scale reading for weight sales', 'boolean', 'scale', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('AllowManualWeight', 'true', 'Allow manual weight entry (with admin approval)', 'boolean', 'scale', 1);

-- =============================================================================
-- POS Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('AutoDebtCreation', 'true', 'Auto-create debt for unpaid sales/purchases', 'boolean', 'pos', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('CashierMaxDiscount', '500', 'Max discount cashier can apply (basis points: 500 = 5%)', 'number', 'pos', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('RequireManagerApprovalDiscount', '1000', 'Discount threshold requiring manager approval (basis points)', 'number', 'pos', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('DefaultPaymentTermDays', '30', 'Default credit payment term in days', 'number', 'pos', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('PrintReceiptOnSale', 'true', 'Automatically print receipt on sale completion', 'boolean', 'pos', 1);

-- =============================================================================
-- Fiscal Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('FiscalYearStart', '01-01', 'Fiscal year start (MM-DD)', 'string', 'fiscal', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('DateFormat', 'YYYY-MM-DD', 'Date display format', 'string', 'fiscal', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('TimeFormat', 'HH:mm', 'Time display format', 'string', 'fiscal', 1);

-- =============================================================================
-- Backup Settings
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('AutoBackupEnabled', 'true', 'Enable automatic daily backups', 'boolean', 'backup', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('BackupRetentionDays', '30', 'Number of days to retain backups', 'number', 'backup', 1);

-- =============================================================================
-- Blueprint 03: Period Locking / Accounting Freeze
-- =============================================================================
INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('accounting_freeze_date', '', 'ISO date: no posting before this date', 'string', 'accounting', 1);

INSERT OR IGNORE INTO system_settings (key, value, description, data_type, setting_group, is_system) VALUES
('period_lock_enabled', 'false', 'Enable period locking (prevent posting in closed periods)', 'boolean', 'accounting', 1);
