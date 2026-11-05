@echo off
setlocal
cd /d "%~dp0"
title Resona - Launcher
if not exist ".venv\Scripts\python.exe" goto setup_first
if not exist "node_modules\vite\bin\vite.js" goto setup_first
powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 8000,5173 -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
    echo Port 8000 or 5173 is already in use.
    echo If Resona is already open, visit http://localhost:5173.
    echo Otherwise close the earlier Resona server windows and try again.
    pause
    exit /b 1
)
start "Resona API" "%ComSpec%" /k ""%~dp0scripts\run-api.cmd""
start "Resona Queue" "%ComSpec%" /k ""%~dp0scripts\run-worker.cmd""
start "Resona Studio" "%ComSpec%" /k ""%~dp0scripts\run-frontend.cmd""
echo Three service windows are opening. Keep all three open while using Resona.
echo Your browser will open when Vite is ready.
echo To stop: press Ctrl+C in each service window, then close it.
exit /b 0
:setup_first
echo Run SETUP-WINDOWS.cmd first, then start Resona again.
pause
