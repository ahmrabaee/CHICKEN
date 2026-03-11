# =============================================================================
# deploy.ps1 — Deploy backend to VPS
# Usage:  .\scripts\deploy.ps1
# =============================================================================

$VPS_USER   = "jaber"
$VPS_HOST   = "155.117.41.196"
$VPS_PATH   = "/home/jaber/app/backend"
$BACKEND    = "$PSScriptRoot\..\backend"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Chicken Shop Backend — Deploy to VPS"          -ForegroundColor Cyan
Write-Host "  $VPS_USER@$VPS_HOST:$VPS_PATH"                 -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Build ──────────────────────────────────────────────────────────────────
Write-Host "[1/4] Building backend..." -ForegroundColor Yellow
Push-Location $BACKEND
npx @nestjs/cli build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }
Pop-Location
Write-Host "      Build OK" -ForegroundColor Green

# ── 2. Upload files ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Uploading files (you will be prompted for SSH password)..." -ForegroundColor Yellow

# Create remote directory
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $VPS_PATH/data $VPS_PATH/prisma"

# Upload compiled app + dependencies manifest
scp -r "$BACKEND\dist"           "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
scp    "$BACKEND\package.json"   "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
scp    "$BACKEND\package-lock.json" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

# Upload Prisma schema + migrations
scp    "$BACKEND\prisma\schema.prisma" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/prisma/"
scp -r "$BACKEND\prisma\migrations"    "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/prisma/" 2>$null

Write-Host "      Upload OK" -ForegroundColor Green

# ── 3. Remote: install deps + migrate + restart ───────────────────────────────
Write-Host ""
Write-Host "[3/4] Running remote setup (install + migrate + restart)..." -ForegroundColor Yellow

$REMOTE_CMDS = @"
set -e
cd $VPS_PATH

echo '--- Installing production dependencies ---'
npm ci --omit=dev

echo '--- Generating Prisma client ---'
npx prisma generate

echo '--- Running DB migrations ---'
npx prisma migrate deploy

echo '--- Restarting service ---'
if pm2 list | grep -q 'chicken-backend'; then
  pm2 restart chicken-backend
else
  pm2 start dist/main.js --name chicken-backend
  pm2 save
fi

echo '--- Done ---'
pm2 status chicken-backend
"@

ssh "$VPS_USER@$VPS_HOST" $REMOTE_CMDS

if ($LASTEXITCODE -ne 0) {
    Write-Host "Remote commands failed!" -ForegroundColor Red
    exit 1
}

# ── 4. Done ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Deploy complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  API:     http://${VPS_HOST}:3000/v1" -ForegroundColor Cyan
Write-Host "  Swagger: http://${VPS_HOST}:3000/api/docs" -ForegroundColor Cyan
Write-Host ""
