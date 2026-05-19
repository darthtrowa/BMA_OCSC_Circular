# Check if PM2 is installed globally
$pm2Command = "pm2"
$npxCommand = "npx.cmd"

if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "PM2 not found in PATH. Using '$npxCommand -y pm2' instead..." -ForegroundColor Yellow
    $pm2Command = "$npxCommand -y pm2"
}

Write-Host "--- Starting BMA Circular System (Local Dev Mode) ---" -ForegroundColor Cyan

# Set location to where the script is located
Set-Location -Path $PSScriptRoot

# Install dependencies if needed
if (!(Test-Path "server\node_modules")) {
    Write-Host "Installing server dependencies..." -ForegroundColor Gray
    Push-Location "server"; npm install; Pop-Location
}
if (!(Test-Path "client\node_modules")) {
    Write-Host "Installing client dependencies..." -ForegroundColor Gray
    Push-Location "client"; npm install; Pop-Location
}

# Stop existing processes
Write-Host "Stopping any existing processes..." -ForegroundColor Gray
if ($pm2Command -eq "pm2") {
    & pm2 delete all 2>$null
} else {
    & $npxCommand -y pm2 delete all 2>$null
}

# Start all services using ecosystem config
Write-Host "Starting all services..." -ForegroundColor Green
if ($pm2Command -eq "pm2") {
    & pm2 start ecosystem.config.js
} else {
    & $npxCommand -y pm2 start ecosystem.config.js
}

# Show Status
Write-Host "------------------------------------"
if ($pm2Command -eq "pm2") {
    & pm2 status
} else {
    & $npxCommand -y pm2 status
}


Write-Host ""
Write-Host "🚀 System is starting up in Local Mode!" -ForegroundColor Cyan
Write-Host "  - Frontend : http://localhost (Mapped from :5173)" -ForegroundColor Green
Write-Host "  - Backend  : http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Tip: To enable http://localhost (Port 80) without Docker," -ForegroundColor Gray
Write-Host "   Run this command ONCE in Admin PowerShell:" -ForegroundColor Gray
Write-Host "   netsh interface portproxy add v4tov4 listenport=80 listenaddress=127.0.0.1 connectport=5173 connectaddress=127.0.0.1" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor White
Write-Host "  pm2 logs                    # View real-time logs"
Write-Host "  pm2 restart all             # Restart all services"
Write-Host "  pm2 stop all                # Stop all services"

