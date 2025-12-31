@echo off
echo [%TIME%] [DEPLOY] Starting deployment script

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] [DEPLOY] Working directory: %CD%
git config --global --add safe.directory %CD%


echo [%TIME%] [DEPLOY] Removing package-lock.json if it exists...
if exist package-lock.json del /f package-lock.json


echo [%TIME%] [DEPLOY] Pulling latest changes from git...
git pull origin main

echo [%TIME%] [DEPLOY] Installing npm dependencies...
call npm install

echo [%TIME%] [DEPLOY] Building application...
call npm run build

echo [%TIME%] [DEPLOY] Killing old node.exe processes...
taskkill /F /IM node.exe 2>nul

echo [%TIME%] [DEPLOY] Waiting 3 seconds...
timeout /t 3 /nobreak >nul

echo [%TIME%] [DEPLOY] Stopping any running "Run Livestock Site" task instances...
SCHTASKS /End /TN "Run Livestock Site" 2>nul

echo [%TIME%] [DEPLOY] Triggering Task Scheduler to start applications...
schtasks /run /tn "Run Livestock Site"

echo [%TIME%] [DEPLOY] Deployment script completed