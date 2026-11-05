@echo off
setlocal
cd /d "%~dp0"
title Resona - Setup
where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "if(Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
if errorlevel 1 goto missing_node
if exist ".venv\Scripts\python.exe" goto install
for %%V in (3.12 3.11 3.13) do (
    py -%%V --version >nul 2>nul
    if not errorlevel 1 (
        py -%%V -m venv .venv
        if errorlevel 1 goto failed
        goto install
    )
)
echo Install Python 3.12 from python.org, including the Python launcher, then run this again.
goto end
:install
call npm.cmd ci
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto failed
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
".venv\Scripts\python.exe" scripts\configure_windows.py
if errorlevel 1 goto failed
echo.
echo Setup complete. Double-click START-RESONA.cmd to open your studio.
echo AI generation also needs a working ACE-Step service. See START-HERE.md.
goto end
:missing_node
echo Install Node.js 22 LTS or newer from nodejs.org, then run this again.
goto end
:failed
echo.
echo Setup stopped. Read the error above. Your existing settings were preserved.
:end
pause
