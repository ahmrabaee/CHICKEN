#!/bin/bash
# =============================================================================
# deploy.sh — Chicken Shop Backend Deployment Script
#
# Usage:
#   bash deploy.sh          # Update existing deployment (pull + build + restart)
#   bash deploy.sh --init   # First-time setup (creates DB, seeds data, starts PM2)
# =============================================================================

# ─── Self-heal: strip Windows CRLF line endings from this script, then re-exec
# This runs once if the file contains \r characters (uploaded from Windows).
if grep -qU $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r//' "$0"
  exec bash "$0" "$@"
fi

set -e  # Exit immediately on any error

# ─── Resolve script location (works regardless of cwd or calling user) ───────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
LOG_DIR="$(dirname "$APP_DIR")/logs"
PM2_APP_NAME="chicken-backend"

# ─── Colour helpers ──────────────────────────────────────────────────────────
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

info()    { echo -e "${GREEN}[deploy]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[deploy]${RESET} $1"; }
error()   { echo -e "${RED}[deploy] ERROR:${RESET} $1"; exit 1; }

# ─── Validate environment ────────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  error ".env file not found in $SCRIPT_DIR — copy .env.example → .env and fill in all values."
fi

# ─── Init mode ───────────────────────────────────────────────────────────────
if [ "$1" = "--init" ]; then
  info "=== FIRST-TIME INITIALISATION ==="

  info "1/7  Creating data/ directory..."
  mkdir -p "$APP_DIR/data"
  mkdir -p "$LOG_DIR"

  info "2/7  Installing npm dependencies (prod only)..."
  cd "$APP_DIR"
  npm install --omit=dev

  info "3/7  Generating Prisma client..."
  npx prisma generate

  info "4/7  Building TypeScript → dist/..."
  npm run build

  info "5/7  Applying schema to SQLite (prisma db push)..."
  npx prisma db push

  info "6/7  Seeding baseline data (roles, accounts, settings)..."
  npm run db:seed:baseline

  info "7/7  Starting app with PM2..."
  pm2 start ecosystem.config.js
  pm2 save

  info "=== Init complete. Run: pm2 logs $PM2_APP_NAME ==="
  exit 0
fi

# ─── Update mode (default) ───────────────────────────────────────────────────
info "=== UPDATING DEPLOYMENT ==="

cd "$APP_DIR"

# Pull latest code if this is a git repo
if [ -d ".git" ]; then
  info "Pulling latest code from git..."
  git pull
fi

info "Installing / updating npm dependencies (prod only)..."
npm install --omit=dev

info "Generating Prisma client..."
npx prisma generate

info "Applying any schema changes (prisma db push)..."
npx prisma db push

info "Building TypeScript → dist/..."
npm run build

info "Restarting app via PM2..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start ecosystem.config.js
  pm2 save
fi

info "=== Update complete. Run: pm2 logs $PM2_APP_NAME ==="
