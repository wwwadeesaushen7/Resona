@echo off
setlocal
cd /d "%~dp0"
echo Resona - PC information
powershell.exe -NoProfile -Command "Write-Host ('CPU: ' + (Get-CimInstance Win32_Processor).Name); Write-Host ('RAM: ' + [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB) + ' GB'); Write-Host 'Graphics:'; Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"
echo.
if exist ".venv\Scripts\python.exe" ".venv\Scripts\python.exe" scripts\check_setup.py
pause
