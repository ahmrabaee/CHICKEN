# Deployment Guide — Chicken Shop Backend

## Database Strategy

This project uses **`prisma db push` + seeding** (not migrations):

| Command | What it does |
|---|---|
| `prisma db push` | Applies `schema.prisma` directly to SQLite — no migration files needed |
| `db:seed:baseline` | Seeds roles, pages, chart of accounts, tax templates, settings |

No migration files needed in Git — the `.gitignore` excluding `prisma/migrations/*` is correct.

---

## Prerequisites

- Ubuntu 22.04+ VPS
- SSH access to the server (you only need the VPS IP + port)

> **No domain needed.** The Tauri desktop app connects directly via `http://VPS_IP:3000/v1`.

---

## Step 1 — Server Provisioning (run once as root)

```bash
# System update
apt update && apt upgrade -y
apt install -y curl git ufw

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PM2 (process manager — keeps app alive after crashes and on reboot)
npm install -g pm2
pm2 startup systemd -u root --hp /root
# ↳ Copy and run the command it prints

# App user and directories
useradd -m -s /bin/bash chicken
mkdir -p /home/chicken/logs
```

---

## Step 2 — Upload the Code

### Option A — SCP from Windows (initial upload)
```powershell
scp -r D:\Projects\jaber_accounting\CHICKEN\app\backend root@YOUR_VPS_IP:/home/chicken/app/backend
```

### Option B — Git
```bash
cd /home/chicken
git clone https://github.com/YOUR_ORG/CHICKEN.git app
```

---

## Step 3 — Configure Environment

```bash
cd /home/chicken/app/backend
cp .env.example .env
nano .env
```

Fill in every value, especially `JWT_SECRET`:
```bash
# Generate a secure secret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 4 — First-Time Deploy

```bash
cd /home/chicken/app/backend
chmod +x deploy.sh
bash deploy.sh --init
```

This will:
1. Create `data/` directory
2. Install npm dependencies (`--omit=dev`)
3. Generate Prisma client (`prisma generate`)
4. Build TypeScript → `dist/`
5. Create SQLite schema (`prisma db push`)
6. Seed baseline data (roles, accounts, settings, etc.)
7. Start the app with PM2

---

## Step 5 — Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000/tcp    # NestJS backend port
ufw enable
ufw status
```

---

## Step 6 — Update Frontend API URL

In the Tauri frontend config, change the API base URL from:
```
http://localhost:3000/v1
```
to:
```
http://YOUR_VPS_IP:3000/v1
```

---

## Updating the App

### Option 1 — Upload `dist/` only via SCP ⚡ (recommended — fastest)

Build locally on Windows, upload only the compiled output. No compilation needed on the server.

**On your Windows machine:**
```powershell
# 1. Build
cd D:\Projects\jaber_accounting\CHICKEN\app\backend
npm run build

# 2. Upload compiled output
scp -r dist/ root@YOUR_VPS_IP:/home/chicken/app/backend/dist/

# 3. If schema.prisma changed, upload it too
scp prisma/schema.prisma root@YOUR_VPS_IP:/home/chicken/app/backend/prisma/schema.prisma
```

**Then on the VPS:**
```bash
cd /home/chicken/app/backend

# Only if schema.prisma was uploaded
npx prisma db push
npx prisma generate

pm2 restart chicken-backend
```

---

### Option 2 — Upload full source via SCP (when you add new npm packages)

**On your Windows machine:**
```powershell
scp -r D:\Projects\jaber_accounting\CHICKEN\app\backend\src root@YOUR_VPS_IP:/home/chicken/app/backend/src/
scp D:\Projects\jaber_accounting\CHICKEN\app\backend\prisma\schema.prisma root@YOUR_VPS_IP:/home/chicken/app/backend/prisma/schema.prisma
scp D:\Projects\jaber_accounting\CHICKEN\app\backend\package.json root@YOUR_VPS_IP:/home/chicken/app/backend/package.json
scp D:\Projects\jaber_accounting\CHICKEN\app\backend\package-lock.json root@YOUR_VPS_IP:/home/chicken/app/backend/package-lock.json
```

**Then on the VPS:**
```bash
cd /home/chicken/app/backend
npm install --omit=dev
npx prisma generate
npx prisma db push
npm run build
pm2 restart chicken-backend
```

---

### Option 3 — rsync (only transfers changed files)

Available in WSL or Git Bash on Windows.

```bash
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='data' \
  --exclude='.env' \
  --exclude='*.db' \
  /mnt/d/Projects/jaber_accounting/CHICKEN/app/backend/ \
  root@YOUR_VPS_IP:/home/chicken/app/backend/
```

**Then on the VPS:**
```bash
cd /home/chicken/app/backend
npm install --omit=dev
npx prisma generate
npx prisma db push
npm run build
pm2 restart chicken-backend
```

---

### Option 4 — Via Git

```bash
cd /home/chicken/app/backend
bash deploy.sh
```

---

### Which method to use?

| Situation | Method |
|---|---|
| Just changed TypeScript code (no new packages, no schema changes) | **Option 1** — upload `dist/` only ⚡ |
| Added/changed npm dependencies | **Option 2** — upload `src/` + `package.json` |
| Want the cleanest long-term workflow | **Option 3** — rsync |
| Using Git | **Option 4** — `bash deploy.sh` |

---

## Useful Commands

| Task | Command |
|---|---|
| View app status | `pm2 status` |
| Live logs | `pm2 logs chicken-backend` |
| Restart app | `pm2 restart chicken-backend` |
| Test API on VPS | `curl http://localhost:3000/v1` |
| DB shell | `cd /home/chicken/app/backend && npx prisma studio` |

---

## Security Checklist

- [ ] `JWT_SECRET` is a random 64+ character hex string
- [ ] `NODE_ENV=production` in `.env`
- [ ] `.env` is NOT committed to Git
- [ ] Port 3000 is open in firewall (`ufw allow 3000/tcp`)
- [ ] PM2 saved and starts on boot (`pm2 save`)
- [ ] `data/` directory exists and is writable by the process
