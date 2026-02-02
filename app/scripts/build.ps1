# Build script for Financial Management Program
# Creates production build

Write-Host "Building Financial Management Program for production..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\..\frontend"
npm run tauri build
