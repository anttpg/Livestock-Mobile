@echo off
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] [JENKINS] Starting log viewer on port 7080...

REM Tell jenkins not to kill this process.
set JENKINS_NODE_COOKIE=dontKillMe

start "Log Viewer" cmd /c "set JENKINS_NODE_COOKIE=dontKillMe && node logViewer.js"

echo [%TIME%] [JENKINS] Log viewer started. Process will persist after build completes.