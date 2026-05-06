# Production Deployment Script for Windows Server
$baseDir = "d:\CSC_Circular"

Write-Host "=== BMA Circular - Production Deployment ===" -ForegroundColor Cyan

# 1. Install PM2 globally if not present
Write-Host "[1/5] Checking PM2..." -ForegroundColor Green
if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "Installing PM2 globally..." -ForegroundColor Yellow
    npm install pm2 -g
    # Setup PM2 to auto-start on Windows boot
    npm install pm2-windows-startup -g
    pm2-startup install
}

# 2. Install Server dependencies
Write-Host "[2/5] Installing backend dependencies..." -ForegroundColor Green
Set-Location -Path "$baseDir\server"
npm install

# 3. Install Client dependencies and Build
Write-Host "[3/5] Building frontend (Production Build)..." -ForegroundColor Green
Set-Location -Path "$baseDir\client"
npm install
npm run build
Write-Host "Build complete! Files are at: $baseDir\client\dist" -ForegroundColor Yellow

# 4. Start all services via ecosystem.config.js
Write-Host "[4/5] Starting all services with PM2..." -ForegroundColor Green
Set-Location -Path "$baseDir"
pm2 delete all 2>$null
pm2 start ecosystem.config.js

# 5. Save PM2 state so it auto-restarts after Windows reboot
Write-Host "[5/5] Saving PM2 state for auto-restart..." -ForegroundColor Green
pm2 save

# Final Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
pm2 status
Write-Host ""
Write-Host "Access points:" -ForegroundColor White
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Yellow
Write-Host "  API      : http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Remember to open Firewall ports 3000 and 5173!" -ForegroundColor Red
