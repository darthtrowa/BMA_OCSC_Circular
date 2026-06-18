# Script to download and install IIS ARR 3.0 and URL Rewrite 2.1
# MUST BE RUN AS ADMINISTRATOR

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Installing IIS ARR 3.0 & URL Rewrite " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if running as Admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] Please run this script as Administrator!" -ForegroundColor Red
    Pause
    Exit
}

# 1. Download and Install URL Rewrite 2.1
Write-Host "`n[1/3] Downloading URL Rewrite 2.1..." -ForegroundColor Yellow
$urlRewriteUrl = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
$rewriteDest = "$env:TEMP\rewrite_amd64.msi"
Invoke-WebRequest -Uri $urlRewriteUrl -OutFile $rewriteDest

Write-Host "Installing URL Rewrite 2.1..." -ForegroundColor Yellow
Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$rewriteDest`" /quiet /norestart" -Wait
Write-Host "URL Rewrite installed successfully." -ForegroundColor Green

# 2. Download and Install ARR 3.0 (Standalone MSI)
Write-Host "`n[2/3] Downloading Application Request Routing (ARR) 3.0..." -ForegroundColor Yellow
$arrUrl = "https://go.microsoft.com/fwlink/?LinkID=615136"
$arrDest = "$env:TEMP\requestRouter_x64.msi"
Invoke-WebRequest -Uri $arrUrl -OutFile $arrDest

Write-Host "Installing ARR 3.0..." -ForegroundColor Yellow
Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$arrDest`" /quiet /norestart" -Wait
Write-Host "ARR 3.0 installed successfully." -ForegroundColor Green

# 3. Restart IIS
Write-Host "`n[3/3] Restarting IIS Services..." -ForegroundColor Yellow
iisreset /noforce

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Installation Complete! " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Pause
