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
npm run db:seed
```

Initialize backup metadata database:

```bash
npm run dev
```

When backend starts, it auto-creates `backup_runs` table in `app/backend/data/backup-meta.db`.

## 2. Full reset (both databases)

Reset main DB and seed again:

```bash
npm run db:push -- --force-reset
npm run db:seed
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

- Main DB seeded: default admin exists (`admin` / `Admin@123` from seed script)
- Backup metadata DB exists after backend startup:
  - `app/backend/data/backup-meta.db`

