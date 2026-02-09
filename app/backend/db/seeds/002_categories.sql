-- =============================================================================
-- Seed 002: Categories
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: Fixed chicken product categories per PRD Section 4.2.1
-- Idempotent: Uses INSERT OR IGNORE
-- =============================================================================

-- Fresh Whole Chicken
INSERT OR IGNORE INTO categories (code, name, name_en, display_order, icon, default_shelf_life_days, storage_type) VALUES
('FRESH_WHOLE', 'دجاج طازج كامل', 'Fresh Whole Chicken', 1, 'chicken', 2, 'fresh');

-- Fresh Chicken Parts
INSERT OR IGNORE INTO categories (code, name, name_en, display_order, icon, default_shelf_life_days, storage_type) VALUES
('FRESH_PARTS', 'قطع دجاج طازج', 'Fresh Chicken Parts', 2, 'drumstick', 2, 'fresh');

-- Frozen Whole Chicken
INSERT OR IGNORE INTO categories (code, name, name_en, display_order, icon, default_shelf_life_days, storage_type) VALUES
('FROZEN_WHOLE', 'دجاج مجمد كامل', 'Frozen Whole Chicken', 3, 'snowflake', 90, 'frozen');

-- Frozen Chicken Parts
INSERT OR IGNORE INTO categories (code, name, name_en, display_order, icon, default_shelf_life_days, storage_type) VALUES
('FROZEN_PARTS', 'قطع دجاج مجمد', 'Frozen Chicken Parts', 4, 'snowflake', 90, 'frozen');

-- Processed Chicken
INSERT OR IGNORE INTO categories (code, name, name_en, display_order, icon, default_shelf_life_days, storage_type) VALUES
('PROCESSED', 'دجاج معالج', 'Processed Chicken', 5, 'fire', 7, 'processed');

-- Extras (bags, spices, etc.)
INSERT OR IGNORE INTO categories (code, name, name_en, display_order, icon, default_shelf_life_days, storage_type) VALUES
('EXTRAS', 'إضافات', 'Extras', 6, 'package', NULL, NULL);
