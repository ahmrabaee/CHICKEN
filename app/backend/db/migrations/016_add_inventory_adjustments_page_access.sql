-- =============================================================================
-- Migration 016: Add inventory adjustments page access key
-- Ensures /inventory/adjustments exists and can be assigned per accountant user
-- =============================================================================

INSERT INTO page_definitions (key, path, title_ar, title_en, group_key, sort_order, is_admin_only)
SELECT
  'inventory-adjustments',
  '/inventory/adjustments',
  'تسوية المخزون',
  'Inventory Adjustments',
  'inventory',
  12,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM page_definitions WHERE key = 'inventory-adjustments'
);

INSERT INTO role_page_access (role_id, page_id, allowed)
SELECT r.id, p.id, 0
FROM roles r
JOIN page_definitions p ON p.key = 'inventory-adjustments'
WHERE r.name = 'accountant'
  AND NOT EXISTS (
    SELECT 1 FROM role_page_access x
    WHERE x.role_id = r.id AND x.page_id = p.id
  );

INSERT INTO user_page_access (user_id, page_id, allowed)
SELECT u.id, p.id, 0
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN page_definitions p ON p.key = 'inventory-adjustments'
WHERE r.name IN ('accountant', 'cashier')
  AND NOT EXISTS (
    SELECT 1 FROM user_page_access x
    WHERE x.user_id = u.id AND x.page_id = p.id
  );
