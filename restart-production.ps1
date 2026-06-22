# Production Restart Script for BMA OCSC Circular
$baseDir = $PSScriptRoot
Set-Location -Path $baseDir

Write-Host "=== Restarting BMA OCSC Circular (Production) ===" -ForegroundColor Cyan

# 1. Restart IIS Web Server (Clears cache and reloads web.config)
Write-Host "Restarting IIS Web Server..." -ForegroundColor Green
& iisreset

# 2. Restart PM2 Services
Write-Host "Restarting PM2 Backend & Frontend Services..." -ForegroundColor Green
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    & pm2 restart all
} else {
    & npx -y pm2 restart all
}

Write-Host ""
Write-Host "✔ System successfully restarted!" -ForegroundColor Green
Write-Host "Use 'pm2 status' to check service states." -ForegroundColor Gray
