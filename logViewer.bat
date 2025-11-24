@echo off
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] [JENKINS] Starting log viewer on port 7080...

REM Start node process in background with Jenkins cookie set in same command
start /B cmd /c "set JENKINS_NODE_COOKIE=dontKillMe && node logViewer.js"

echo [%TIME%] [JENKINS] Log viewer started as background process.