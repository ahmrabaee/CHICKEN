#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Chicken Shop Backend Deploy / Update Script
#
# This project uses: prisma db push + seed (NOT prisma migrate)
#
# Usage:
#   First deploy:  bash deploy.sh --init
#   Update:        bash deploy.sh
# =============================================================================
set -euo pipefail

APP_DIR="/home/chicken/app/backend"
LOG_DIR="/home/chicken/logs"
DATA_DIR="$APP_DIR/data"
PM2_APP="chicken-backend"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

INIT=false
[[ "${1:-}" == "--init" ]] && INIT=true

# ── Guard: .env must exist and JWT_SECRET must be set ─────────────────────────
[[ -f "$APP_DIR/.env" ]] || fail ".env not found at $APP_DIR/.env — copy from .env.example and fill in values."
grep -q "CHANGE_ME" "$APP_DIR/.env" && fail "JWT_SECRET still has placeholder value. Set a real secret in .env"

# ── First-time init ───────────────────────────────────────────────────────────
if $INIT; then
  log "First-time setup..."

  mkdir -p "$LOG_DIR"
  mkdir -p "$DATA_DIR"

  cd "$APP_DIR"

  log "Installing dependencies..."
  npm install --omit=dev

  log "Generating Prisma client..."
  npx prisma generate

  log "Building TypeScript..."
  npm run build

  log "Creating database schema with db:push..."
  npx prisma db push

  log "Seeding baseline data (roles, settings, chart of accounts, etc.)..."
  npm run db:seed:baseline

  log "Starting with PM2..."
  pm2 start ecosystem.config.js
  pm2 save

  log ""
  log "✅ First-time setup complete!"
  log "   API running at: http://localhost:3000/v1"
  log "   Swagger:        http://localhost:3000/api/docs"
  log "   PM2 status:     pm2 status"
  log "   Logs:           pm2 logs $PM2_APP"
  log ""
  exit 0
fi

# ── Update mode ───────────────────────────────────────────────────────────────
log "Updating $PM2_APP..."
cd "$APP_DIR"

log "Pulling latest code..."
git pull

log "Installing dependencies..."
npm install --omit=dev

log "Generating Prisma client..."
npx prisma generate

log "Applying schema changes (db:push)..."
npx prisma db push

log "Building TypeScript..."
npm run build

log "Restarting PM2..."
pm2 restart ecosystem.config.js --update-env

log ""
log "✅ Update complete!"
log "   PM2 status: pm2 status"
log "   Logs:       pm2 logs $PM2_APP"
