# Check if PM2 is installed globally
$pm2Command = "pm2"
if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "PM2 not found in PATH. Using 'npx pm2' instead..." -ForegroundColor Yellow
    $pm2Command = "npx pm2"
}

Write-Host "--- Starting BMA Circular System ---" -ForegroundColor Cyan

Set-Location -Path "d:\CSC_Circular"

# Install dependencies if needed
if (!(Test-Path "server\node_modules")) {
    Write-Host "Installing server dependencies..." -ForegroundColor Gray
    Set-Location -Path "d:\CSC_Circular\server"; npm install; Set-Location -Path "d:\CSC_Circular"
}
if (!(Test-Path "client\node_modules")) {
    Write-Host "Installing client dependencies..." -ForegroundColor Gray
    Set-Location -Path "d:\CSC_Circular\client"; npm install; Set-Location -Path "d:\CSC_Circular"
}

# Stop existing processes
Write-Host "Stopping any existing processes..." -ForegroundColor Gray
Invoke-Expression "$pm2Command delete all" 2>$null

# Start all services using ecosystem config
Write-Host "Starting all services..." -ForegroundColor Green
Invoke-Expression "$pm2Command start ecosystem.config.js"

# Show Status
Write-Host "------------------------------------"
Invoke-Expression "$pm2Command status"
Write-Host ""
Write-Host "System is starting up!" -ForegroundColor Cyan
Write-Host "  - Frontend : http://localhost:5173" -ForegroundColor Yellow
Write-Host "  - Backend  : http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor White
Write-Host "  pm2 logs              # ดู log แบบ real-time"
Write-Host "  pm2 logs circular-frontend  # ดู log เฉพาะ Frontend"
Write-Host "  pm2 restart all       # Restart ทุกอย่าง"
Write-Host "  pm2 stop all          # หยุดทุกอย่าง"
