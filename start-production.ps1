# Production Startup Script for BMA OCSC Circular
$baseDir = $PSScriptRoot
Set-Location -Path $baseDir

Write-Host "=== Starting BMA OCSC Circular (Production) ===" -ForegroundColor Cyan

# 1. Start IIS Web Server
Write-Host "Starting IIS Web Server..." -ForegroundColor Green
& iisreset /start

# 2. Start PM2 Services
Write-Host "Starting PM2 Backend & Frontend Services..." -ForegroundColor Green
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    & pm2 start ecosystem.config.js
    & pm2 save
} else {
    & npx -y pm2 start ecosystem.config.js
    & npx -y pm2 save
}

Write-Host ""
Write-Host "[OK] System successfully started!" -ForegroundColor Green
Write-Host "Use 'pm2 status' to check service states." -ForegroundColor Gray
