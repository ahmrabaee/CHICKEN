# Database Init Guide (Simple)

This backend uses **two SQLite databases**:

- Main app DB (Prisma): `app/backend/prisma/data/app.db`
- Backup metadata DB: `app/backend/data/backup-meta.db`

## 1. First-time initialization

From project root:

```bash
cd app/backend
npm install
```

Create env file if needed:

```bash
copy .env.example .env
```

Initialize main database:

```bash
npm run db:generate
npm run db:push
# Baseline production-ready data only
npm run db:seed

# Optional: deterministic fixtures for local/dev testing
npm run db:seed:dev
```

Initialize backup metadata database:

```bash
npm run dev
```

When backend starts, it auto-creates `backup_runs` table in `app/backend/data/backup-meta.db`.

## 2. Full reset (both databases)

Reset main DB and seed again:

```bash
npm run db:reset:baseline

# Optional: deterministic fixtures for local/dev testing
npm run db:seed:dev
```

Reset backup metadata DB:

```bash
del app\\backend\\data\\backup-meta.db
```

Then start backend once to recreate it:

```bash
cd app/backend
npm run dev
```

## 3. Quick checks

- Baseline seed completed:
  - `system_settings.setup_completed = false`
  - Required reference/configuration data exists (roles, pages, categories, accounts, tax templates)
  - `db:seed`/`db:seed:baseline` does **not** delete existing users or runtime transactions
- If `npm run db:seed:dev` or `npm run db:seed:test` was used:
  - `system_settings.setup_completed = true`
  - Default admin exists (`admin` / `Admin@123`)
  - Deterministic fixture transactions/customers/suppliers exist
- Backup metadata DB exists after backend startup:
  - `app/backend/data/backup-meta.db`

## 4. Seed profiles summary

- `npm run db:seed` or `npm run db:seed:baseline`:
  - Production baseline only (no users, no fake transactional fixtures)
- `npm run db:seed:dev`:
  - Baseline + admin user + deterministic dev fixtures
- `npm run db:seed:test`:
  - Baseline + admin user + deterministic test fixtures


