# Chicken Shop Database Schema Documentation

## Version: 1.0.0
## Last Updated: February 6, 2026
## Database: SQLite (latest stable)

---

## 1. Assumptions & Interpretation

### 1.1 Concrete Assumptions (PRD Ambiguities Resolved)

| Area | Assumption | Rationale |
|------|------------|-----------|
| **Primary Keys** | Using INTEGER PRIMARY KEY with AUTOINCREMENT for sequential IDs instead of GUIDs | SQLite performs better with integer PKs; GUIDs can be stored as TEXT if interoperability needed later |
| **Timestamps** | All timestamps stored as TEXT in ISO-8601 format (YYYY-MM-DDTHH:MM:SS.sssZ) | SQLite lacks native datetime type; TEXT ISO-8601 is sortable and parseable |
| **Currency** | All monetary values stored as INTEGER in minor units (fils/cents) | Avoids floating-point precision issues; 163.88 SAR = 16388 |
| **Weight** | Weight stored as INTEGER in grams (not kg) internally | Precision to 1g; 1.523 kg = 1523 grams; display converts to kg |
| **Percentages** | Stored as INTEGER with 2 decimal precision (15.00% = 1500) | Consistent handling, avoids float issues |
| **Multi-Branch** | Single branch initially, but schema supports multi-branch from day one | PRD mentions "single shop initially, scalable to multiple branches" |
| **Soft Deletes** | Using `is_active` boolean instead of `deleted_at` for most entities | Simpler queries; true soft-delete (deleted_at) for critical entities like sales |
| **User Passwords** | Storing bcrypt hash in password_hash column | Standard secure password storage |
| **JSON Fields** | Using TEXT for JSON columns | SQLite stores JSON as TEXT; use json() functions for validation |
| **Lot Numbers** | Auto-generated format: LOT-YYYYMMDD-XXXX | Chronological, searchable, unique |
| **Invoice Numbers** | Auto-generated format: SAL-000001, PUR-000001 | Sequential, prefix configurable |
| **Party Balance** | Computed balance columns stored and updated via triggers | Avoids expensive sum queries on debt tables |

### 1.2 Future-Proofing Decisions

| Decision | Implementation | Rationale |
|----------|----------------|-----------|
| **Audit Trail** | `audit_logs` table captures all critical changes | Compliance, debugging, never delete financial records |
| **Soft Deletes** | `voided_at` for sales/purchases instead of DELETE | Preserve transaction history |
| **Schema Versioning** | `schema_versions` meta table | Track applied migrations |
| **Extensibility** | `metadata` JSON column on key entities | Store chicken-specific data without schema changes |
| **Index Strategy** | Indexes on all FKs + common query patterns | PRD-driven performance optimization |
| **Triggers** | Automatic `updated_at` maintenance | Consistency without application logic |

---

## 2. Domain Model Summary

### 2.1 Core Entities

| Entity | Description | PRD Reference |
|--------|-------------|---------------|
| `categories` | Product categories (Fresh Whole, Fresh Parts, Frozen, etc.) | Section 4.2.1 |
| `items` | Chicken products master data | Section 4.2.1 |
| `inventory` | Current stock levels per item | Section 4.2.2 |
| `inventory_lots` | FIFO lot tracking for cost allocation | Section 4.2.2 |
| `stock_movements` | Audit trail for all inventory changes | Section 4.2.2 |
| `wastage_records` | Spoilage/trimming/expiry tracking | Section 4.2.2 |
| `customers` | Customer master with credit limits | Section 4.2.6 |
| `suppliers` | Supplier master data | Section 4.2.6 |
| `sales` | Sales transactions header | Section 4.2.3 |
| `sale_lines` | Sales line items (weight-based) | Section 4.2.3 |
| `sale_line_cost_allocations` | FIFO cost tracking per sale line | Section 4.2.3 |
| `purchases` | Purchase orders header | Section 4.2.4 |
| `purchase_lines` | Purchase line items | Section 4.2.4 |
| `payments` | Payment receipts/disbursements | Section 4.2.5 |
| `debts` | Receivables (owed to us) and payables (we owe) | Section 4.2.5 |
| `expenses` | Operating expenses | Section 4.2.7 |
| `expense_categories` | Expense classification | Section 4.2.7 |
| `users` | System users (Admin/Cashier) | Section 4.2.8 |
| `roles` | Admin and Cashier roles | Section 3 |
| `user_roles` | Many-to-many user-role assignment | Section 3 |
| `branches` | Shop branches/locations | Section 2.1 |
| `accounts` | Chart of accounts | Section 6.1 |
| `journal_entries` | Double-entry journal headers | Section 6.2 |
| `journal_entry_lines` | Journal debit/credit lines | Section 6.2 |
| `system_settings` | Key-value configuration | Section 2.1 |
| `audit_logs` | System-wide audit trail | Section 4.2.9 |

### 2.2 Relationships & Cardinalities

```
categories 1:N items
  └─ One category has many items

items 1:1 inventory
  └─ Each item has exactly one inventory record

items 1:N inventory_lots
  └─ One item can have multiple lots (FIFO)

items 1:N sale_lines
  └─ One item appears in many sale lines

items 1:N purchase_lines
  └─ One item appears in many purchase lines

items 1:N stock_movements
  └─ One item has many movement records

items 1:N wastage_records
  └─ One item can have many wastage entries

customers 1:N sales
  └─ One customer has many sales (optional for walk-in)

customers 1:N debts
  └─ One customer has many debt records

customers 1:N payments
  └─ One customer makes many payments

suppliers 1:N purchases
  └─ One supplier has many purchases

suppliers 1:N debts
  └─ One supplier has many debt records (payables)

suppliers 1:N payments
  └─ We make many payments to one supplier

sales 1:N sale_lines
  └─ One sale has many line items

sales 1:N payments
  └─ One sale receives multiple payments

sales 1:1? debts
  └─ Credit sale creates one debt record

sale_lines 1:N sale_line_cost_allocations
  └─ One sale line allocated across multiple lots (FIFO)

sale_lines N:1 inventory_lots (via allocations)
  └─ Many sale lines consume from many lots

purchases 1:N purchase_lines
  └─ One purchase has many line items

purchases 1:N payments
  └─ One purchase receives multiple payments

purchases 1:1? debts
  └─ Credit purchase creates one debt record

purchase_lines 1:1? inventory_lots
  └─ Receiving creates one lot per line

inventory_lots N:1 purchases
  └─ Many lots come from many purchases

users N:M roles (via user_roles)
  └─ Users assigned multiple roles (typically one)

branches 1:N sales
  └─ Sales belong to one branch

branches 1:N purchases
  └─ Purchases belong to one branch

branches 1:N inventory (via lots)
  └─ Stock tracked per branch

accounts 1:N journal_entry_lines
  └─ Many journal lines reference one account

journal_entries 1:N journal_entry_lines
  └─ One entry has multiple debit/credit lines

expense_categories 1:N expenses
  └─ Many expenses belong to one category
```

### 2.3 Many-to-Many Implementation

| Relationship | Join Table | FK1 | FK2 |
|--------------|------------|-----|-----|
| Users ↔ Roles | `user_roles` | `user_id` | `role_id` |
| SaleLines ↔ InventoryLots | `sale_line_cost_allocations` | `sale_line_id` | `lot_id` |

---

## 3. Naming Conventions

### Tables
- **snake_case, plural**: `sales`, `inventory_lots`, `stock_movements`

### Columns
- **snake_case**: `created_at`, `customer_id`, `total_amount`
- **Primary Key**: `id` (INTEGER PRIMARY KEY)
- **Foreign Keys**: `<singular_table>_id` (e.g., `customer_id`, `item_id`)
- **Booleans**: `is_` prefix (`is_active`, `is_voided`, `is_approved`)
- **Timestamps**: `_at` suffix (`created_at`, `updated_at`, `voided_at`)
- **Monetary**: `_amount` suffix, stored as INTEGER (minor units)
- **Weight**: `_grams` suffix, stored as INTEGER (grams)
- **Percentages**: `_pct` suffix, stored as INTEGER (basis points)

### Indexes
- **Format**: `idx_<table>_<column(s)>`
- **Example**: `idx_sales_customer_id`, `idx_inventory_lots_item_received`

### Triggers
- **Format**: `trg_<table>_<action>`
- **Example**: `trg_sales_updated_at`, `trg_inventory_after_sale`

---

## 4. Data Type Mappings

| Concept | SQLite Type | Storage | Display Conversion |
|---------|-------------|---------|-------------------|
| ID | INTEGER PRIMARY KEY | Auto-increment | As-is |
| UUID | TEXT(36) | GUID string | As-is |
| String | TEXT | UTF-8 | As-is |
| Money | INTEGER | Minor units (fils) | ÷ 100 |
| Weight | INTEGER | Grams | ÷ 1000 → kg |
| Percentage | INTEGER | Basis points | ÷ 100 → % |
| Boolean | INTEGER | 0 or 1 | true/false |
| Timestamp | TEXT | ISO-8601 | Format for locale |
| Date | TEXT | YYYY-MM-DD | Format for locale |
| JSON | TEXT | JSON string | Parse as object |
| Enum | TEXT | Value string | Map to display |

---

## 5. Constraint Reference

### Foreign Key Actions

| Scenario | ON DELETE | ON UPDATE | Example |
|----------|-----------|-----------|---------|
| Parent required, cascade | CASCADE | CASCADE | sale_lines → sales |
| Parent required, protect | RESTRICT | CASCADE | sales → customers |
| Parent optional | SET NULL | CASCADE | sales → customers (NULL OK) |
| Audit reference | SET NULL | CASCADE | audit_logs → users |

### Common CHECK Constraints

```sql
-- Non-negative amounts
CHECK (total_amount >= 0)

-- Weight must be positive for sales
CHECK (weight_grams > 0)

-- Percentage in valid range (0-10000 = 0-100%)
CHECK (tax_rate_pct >= 0 AND tax_rate_pct <= 10000)

-- Enum validation
CHECK (payment_status IN ('unpaid', 'partial', 'paid'))

-- Date format validation
CHECK (sale_date LIKE '____-__-__T__:__:__Z' OR sale_date LIKE '____-__-__T__:__:__.___Z')
```

---

## 6. PRD to Schema Mapping

| PRD Requirement | Table(s) | Column(s) | Constraint/Index |
|-----------------|----------|-----------|------------------|
| Weight-based selling only | sale_lines | weight_grams | CHECK > 0 |
| FIFO cost allocation | sale_line_cost_allocations, inventory_lots | lot_id, received_at | ORDER BY received_at ASC |
| Live bird shrinkage tracking | purchase_lines | metadata (JSON) | gross_weight, net_weight, shrinkage_pct |
| 2-day fresh shelf life | items | shelf_life_days | DEFAULT 2 for fresh |
| 90-day frozen shelf life | items | shelf_life_days | DEFAULT 90 for frozen |
| Customer credit limits | customers | credit_limit | CHECK >= 0 |
| Daily wastage tracking | wastage_records | wastage_date, type | INDEX on date |
| Two roles only | roles | name | CHECK IN ('admin', 'cashier') |
| Cashier discount limit 5% | system_settings | cashier_max_discount | Value: 500 (5%) |
| Scale required | items | requires_scale | DEFAULT 1 |
| Void with reason | sales | voided_at, void_reason, voided_by | NOT NULL when voided |
| Auto debt creation | debts | source_type, source_id | Trigger on sale/purchase |
| Audit logging | audit_logs | entity_type, entity_id, changes | Immutable table |
| Arabic/RTL support | items, categories, etc. | name_ar (primary) | TEXT UTF-8 |

---

## 7. File Structure

```
db/
├── SCHEMA_DOCUMENTATION.md    # This file
├── migrations/
│   ├── 001_init_core.sql      # Core tables, roles, users
│   ├── 002_inventory.sql      # Items, categories, inventory
│   ├── 003_parties.sql        # Customers, suppliers
│   ├── 004_transactions.sql   # Sales, purchases, payments
│   ├── 005_accounting.sql     # Accounts, journal entries
│   ├── 006_audit.sql          # Audit logs, system settings
│   └── 007_indexes.sql        # All indexes (can run separately)
├── seeds/
│   ├── 001_roles.sql          # Admin/Cashier roles
│   ├── 002_categories.sql     # Chicken categories
│   ├── 003_accounts.sql       # Chart of accounts
│   ├── 004_settings.sql       # Default system settings
│   ├── 005_expense_categories.sql
│   └── 006_sample_data.sql    # Optional demo data
├── queries/
│   └── example_queries.sql    # 10+ PRD workflow queries
└── schema.sql                 # Complete single-file schema
```

---

## 8. Scalability & Maintainability Notes

### 8.1 Handling Growth

| Challenge | Strategy | Implementation |
|-----------|----------|----------------|
| **Large Transaction Tables** | Partition by date using SQLite attached databases | Archive monthly: `ATTACH 'sales_2025_01.db' AS archive; INSERT INTO archive.sales SELECT * FROM sales WHERE sale_date < '2025-02-01';` |
| **Inventory Lots Accumulation** | Archive depleted lots | Move `is_depleted = 1` lots to `inventory_lots_archive` table after 90 days |
| **Audit Log Growth** | Rotate logs to separate database | Create `audit_logs_YYYYMM.db` monthly, query via UNION when needed |
| **Journal Entry Lines** | Index-only scans | Covering indexes on account_id + amounts for trial balance |
| **Stock Movements** | Summary tables | Daily rollup to `stock_movements_daily` for faster reporting |

### 8.2 Multi-Branch Scaling

```sql
-- All key tables already have branch_id foreign key
-- To add new branch:
INSERT INTO branches (code, name, name_en, address, is_active)
VALUES ('BR002', 'فرع الدمام', 'Dammam Branch', 'شارع الخليج', 1);

-- Inventory is per-branch via inventory.branch_id (add if needed)
-- Sales/Purchases already track branch_id
-- Reporting filters: WHERE branch_id = :branch OR :branch IS NULL
```

### 8.3 Column Addition Best Practices

```sql
-- Adding new columns (always with DEFAULT for existing rows)
ALTER TABLE items ADD COLUMN halal_certification_number TEXT;
ALTER TABLE items ADD COLUMN organic_certified INTEGER DEFAULT 0;

-- Never break existing code - always allow NULL or provide DEFAULT
-- For required columns, add in 3 phases:
-- 1. ADD COLUMN with DEFAULT
-- 2. Backfill data
-- 3. Create CHECK constraint in next migration
```

### 8.4 Column Deprecation Strategy

```sql
-- Phase 1: Mark column as deprecated (documentation)
-- Phase 2: Stop writing to column in application
-- Phase 3: After 6 months, verify no reads
-- Phase 4: SQLite cannot DROP COLUMN directly, so:

-- Create new table without deprecated column
CREATE TABLE items_new AS SELECT col1, col2, ... FROM items;
-- Drop old, rename new
DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
-- Recreate indexes and triggers
```

### 8.5 Query Performance Guidelines

| Pattern | Recommendation |
|---------|----------------|
| **Pagination** | Always use `LIMIT :size OFFSET :page * :size` with ORDER BY indexed column |
| **Date Ranges** | Index on date columns; use `date(column) BETWEEN` for day-level queries |
| **Aggregations** | Pre-compute in summary tables for dashboards; refresh nightly |
| **Full-text Search** | Use SQLite FTS5 for item name search: `CREATE VIRTUAL TABLE items_fts USING fts5(name, name_en, content=items)` |
| **JSON Queries** | Minimize; extract to indexed columns if query is frequent |

### 8.6 Backup & Recovery

```powershell
# Hot backup (SQLite backup API)
sqlite3 chicken_shop.db ".backup 'backup_$(Get-Date -Format yyyyMMdd_HHmmss).db'"

# WAL checkpoint before backup
sqlite3 chicken_shop.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Verify backup integrity
sqlite3 backup.db "PRAGMA integrity_check;"
```

### 8.7 Migration Execution Order

```powershell
# Fresh install
$migrations = Get-ChildItem "db/migrations/*.sql" | Sort-Object Name
foreach ($m in $migrations) {
    sqlite3 chicken_shop.db ".read '$($m.FullName)'"
}

# Apply seeds
$seeds = Get-ChildItem "db/seeds/*.sql" | Sort-Object Name
foreach ($s in $seeds) {
    sqlite3 chicken_shop.db ".read '$($s.FullName)'"
}

# Track applied migrations
sqlite3 chicken_shop.db "INSERT INTO schema_versions (version, description) VALUES ('001', 'init_core');"
```

### 8.8 Future Extension Points

| Feature | Schema Impact | Notes |
|---------|---------------|-------|
| **Online Ordering** | Add `order_source` to sales | Enum: 'pos', 'web', 'app' |
| **Delivery** | New `deliveries` table | FK to sales, driver assignment, status tracking |
| **Loyalty Points** | Add `loyalty_points` to customers | Trigger to calculate on sale completion |
| **Multi-Currency** | Add `currency_code`, `exchange_rate` to transactions | Store in original currency + SAR equivalent |
| **Promotions** | New `promotions`, `promotion_items` tables | Time-based discounts |
| **Barcodes by Weight** | Price-embedded barcode decoding | Parse weight from GS1 barcode prefix |

### 8.9 Performance Monitoring

```sql
-- Check index usage
EXPLAIN QUERY PLAN SELECT * FROM sales WHERE sale_date = '2026-02-06';

-- Analyze for query planner
ANALYZE;

-- Check table sizes
SELECT name, SUM(pgsize) as size_bytes 
FROM dbstat 
GROUP BY name 
ORDER BY size_bytes DESC;

-- Vacuum to reclaim space
VACUUM;
```

---

## 9. Quick Reference

### Essential PRAGMAs for Production

```sql
PRAGMA foreign_keys = ON;           -- Enable FK enforcement
PRAGMA journal_mode = WAL;          -- Write-ahead logging
PRAGMA synchronous = NORMAL;        -- Balance durability/performance
PRAGMA cache_size = -64000;         -- 64MB cache
PRAGMA temp_store = MEMORY;         -- Temp tables in RAM
PRAGMA mmap_size = 268435456;       -- 256MB memory-mapped I/O
```

### Common Operations Cheatsheet

| Operation | Command |
|-----------|---------|
| Run all migrations | `Get-ChildItem db/migrations/*.sql \| ForEach { sqlite3 db.sqlite ".read $_" }` |
| Export to JSON | `sqlite3 db.sqlite -json "SELECT * FROM items" > items.json` |
| Import from CSV | `sqlite3 db.sqlite ".import --csv items.csv items"` |
| Find missing FKs | `PRAGMA foreign_key_check;` |
| List all indexes | `SELECT * FROM sqlite_master WHERE type = 'index';` |
