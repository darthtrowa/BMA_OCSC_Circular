# Script to enable IIS ARR Proxy
# MUST BE RUN AS ADMINISTRATOR

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Enabling IIS ARR Proxy " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if running as Admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] Please run this script as Administrator!" -ForegroundColor Red
    Pause
    Exit
}

$appcmd = "$env:systemroot\system32\inetsrv\appcmd.exe"
if (Test-Path $appcmd) {
    Write-Host "Enabling ARR Proxy..." -ForegroundColor Yellow
    & $appcmd set config -section:system.webServer/proxy /enabled:"True" /commit:apphost
    
    Write-Host "Restarting IIS..." -ForegroundColor Yellow
    iisreset /noforce
    
    Write-Host "ARR Proxy enabled successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] IIS AppCmd tool not found!" -ForegroundColor Red
}

Pause
