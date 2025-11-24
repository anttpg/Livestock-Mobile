@echo off
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] [JENKINS] Starting log viewer on port 7080...

powershell -Command "Start-Process node -ArgumentList 'logViewer.js' -WindowStyle Normal -WorkingDirectory '%SCRIPT_DIR%'"

echo [%TIME%] [JENKINS] Log viewer started as detached process.