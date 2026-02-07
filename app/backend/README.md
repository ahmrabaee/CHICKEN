# Chicken Shop Backend

SQLite database with Prisma ORM for the Chicken Shop POS, Inventory & Accounting System.

## Prerequisites

- Node.js 18+
- npm or bun

## Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Create database and run migrations
npm run db:push

# Seed initial data
npm run db:seed
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create and apply migrations (dev) |
| `npm run db:migrate:prod` | Apply migrations (production) |
| `npm run db:seed` | Seed reference data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database (WARNING: deletes all data) |
| `npm run build` | Compile TypeScript |
| `npm run dev` | Run in development mode |

## Database Schema

### Core Tables

- **branches** - Shop locations
- **roles** - System roles (admin, cashier)
- **users** - System users
- **user_roles** - User-role assignments

### Inventory

- **categories** - Product categories
- **items** - Chicken products
- **inventory** - Stock summary
- **inventory_lots** - FIFO lot tracking
- **stock_movements** - Inventory audit trail
- **wastage_records** - Spoilage tracking

### Customers & Suppliers

- **customers** - Customer master
- **suppliers** - Supplier master

### Transactions

- **sales** - Sale invoices
- **sale_lines** - Sale line items
- **sale_line_cost_allocations** - FIFO cost allocations
- **purchases** - Purchase orders
- **purchase_lines** - Purchase line items
- **payments** - Payment records
- **debts** - Receivables & payables

### Expenses

- **expense_categories** - Expense classification
- **expenses** - Operating expenses

### Accounting

- **accounts** - Chart of accounts
- **journal_entries** - Journal headers
- **journal_entry_lines** - Journal lines

### System

- **system_settings** - Configuration
- **audit_logs** - Audit trail
- **schema_versions** - Migration tracking

## Default Credentials

After seeding, you can login with:

- **Username:** `admin`
- **Password:** `Admin@123`

> ⚠️ Change the default password in production!

## Data Conventions

| Type | Storage | Display |
|------|---------|---------|
| Currency | INTEGER (halalas) | SAR with 2 decimals |
| Weight | INTEGER (grams) | kg with 3 decimals |
| Percentage | INTEGER (basis points) | % with 2 decimals |
| Timestamps | DateTime (UTC) | Local timezone |

### Examples

```typescript
// Convert SAR to minor units
const priceInHalalas = toMinorUnits(25.50); // 2550

// Convert kg to grams
const weightInGrams = toGrams(1.523); // 1523

// Convert basis points to percentage
const percentage = 1500 / 100; // 15.00%
```

## Usage Example

```typescript
import { prisma, generateSaleNumber, allocateFIFO } from './src/index.js';

// Get all active items
const items = await prisma.item.findMany({
  where: { isActive: true },
  include: { category: true },
});

// Allocate from lots using FIFO
const allocations = await allocateFIFO(itemId, 1500); // 1.5 kg

// Generate sale number
const saleNumber = await generateSaleNumber(); // SAL-000001
```

## File Structure

```
backend/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed script
├── src/
│   ├── index.ts         # Exports
│   └── lib/
│       ├── prisma.ts    # Prisma client singleton
│       └── db.ts        # Database utilities
├── db/                  # Legacy SQL files (reference)
│   ├── schema.sql
│   ├── migrations/
│   ├── seeds/
│   └── queries/
├── .env                 # Environment config
├── package.json
└── tsconfig.json
```
