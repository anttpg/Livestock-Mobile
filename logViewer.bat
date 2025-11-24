@echo off
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] [JENKINS] Starting log viewer on port 7080 via Task Scheduler...

SCHTASKS /Run /TN "Livestock-LogViewer"

echo [%TIME%] [JENKINS] Log viewer task triggered.