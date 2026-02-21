-- =============================================================================
-- Migration 015: Per-user page access (UserPageAccess)
-- Each accountant has their own page permissions, not shared by role
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_page_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    page_id INTEGER NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (page_id) REFERENCES page_definitions(id) ON DELETE CASCADE,
    UNIQUE(user_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_user_page_access_user ON user_page_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_page_access_page ON user_page_access(page_id);
