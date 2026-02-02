# Development script for Financial Management Program
# Run the Tauri development server

Write-Host "Starting Financial Management Program in development mode..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\..\frontend"
npm run tauri dev
