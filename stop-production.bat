@echo off
TITLE BMA OCSC Circular - Stop Production
echo Stopping BMA OCSC Circular Production System...
powershell -ExecutionPolicy Bypass -File "%~dp0stop-production.ps1"
pause
