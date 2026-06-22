@echo off
TITLE BMA OCSC Circular - Start Production
echo Starting BMA OCSC Circular Production System...
powershell -ExecutionPolicy Bypass -File "%~dp0start-production.ps1"
pause
