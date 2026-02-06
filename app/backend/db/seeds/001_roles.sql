-- =============================================================================
-- Seed 001: Roles
-- Chicken Shop POS, Inventory & Accounting System
-- 
-- Description: System roles (Admin and Cashier only per PRD)
-- Idempotent: Uses INSERT OR IGNORE
-- =============================================================================

-- Admin role with full permissions
INSERT OR IGNORE INTO roles (name, name_ar, description, permissions, is_system_role) VALUES
('admin', 'مدير / مالك', 'Full system access: sales, purchases, inventory, customers, suppliers, expenses, reports, settings, user management, approvals',
'["sales.create","sales.view","sales.edit","sales.delete","sales.void","sales.discount.apply","purchases.create","purchases.view","purchases.receive","purchases.liveBird","inventory.view","inventory.adjust","inventory.transfer","inventory.waste","customers.create","customers.view","customers.edit","customers.creditLimit","suppliers.manage","payments.receive","payments.make","expenses.create","expenses.view","reports.dailySales","reports.profit","reports.inventory","reports.wastage","reports.financial","system.settings","system.users","system.backup","system.branches"]',
1);

-- Cashier role with limited permissions
INSERT OR IGNORE INTO roles (name, name_ar, description, permissions, is_system_role) VALUES
('cashier', 'كاشير / بائع', 'Limited access: POS operations, sales, customer queries, receive payments, basic reports only',
'["sales.create","sales.view","inventory.view","customers.create","customers.view","payments.receive","reports.dailySales"]',
1);
