# Production Shutdown/Stop Script for BMA OCSC Circular
$baseDir = $PSScriptRoot
Set-Location -Path $baseDir

Write-Host "=== Stopping BMA OCSC Circular (Production) ===" -ForegroundColor Cyan

# 1. Stop PM2 Services
Write-Host "Stopping PM2 Backend & Frontend Services..." -ForegroundColor Green
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    & pm2 stop all
} else {
    & npx -y pm2 stop all
}

# 2. Stop IIS Web Server (Optional: Keep it running for other sites, or stop it if dedicated)
# By default, we stop the IIS services. If you only want to stop the website, use Stop-WebSite.
# Here we do a graceful iisreset /stop.
Write-Host "Stopping IIS Web Server..." -ForegroundColor Green
& iisreset /stop

Write-Host ""
Write-Host "[OK] System successfully stopped!" -ForegroundColor Yellow
