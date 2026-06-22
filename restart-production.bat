@echo off
TITLE BMA OCSC Circular - Restart Production
echo Restarting BMA OCSC Circular Production System...
powershell -ExecutionPolicy Bypass -File "%~dp0restart-production.ps1"
pause
