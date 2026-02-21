-- =============================================================================
-- Migration 014: Dynamic page access (DYNAMIC_PAGE_ACCESS_PLAN)
-- Adds page_definitions and role_page_access for admin-configurable accountant access
-- =============================================================================

CREATE TABLE IF NOT EXISTS page_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    group_key TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_admin_only INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS role_page_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    page_id INTEGER NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (page_id) REFERENCES page_definitions(id) ON DELETE CASCADE,
    UNIQUE(role_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_role_page_access_role ON role_page_access(role_id);
CREATE INDEX IF NOT EXISTS idx_role_page_access_page ON role_page_access(page_id);
