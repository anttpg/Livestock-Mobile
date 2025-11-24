@echo off
REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

git config --global --add safe.directory %CD%
git pull origin main
call npm install
call npm run build

@REM echo Killing old processes...
@REM taskkill /F /IM node.exe 2>nul
@REM timeout /t 3

echo Triggering Task Scheduler to start applications...
schtasks /run /tn "Run Livestock Site"

@REM echo Rebooting system in 10 seconds...
@REM echo Press Ctrl+C to cancel
@REM timeout /t 10

@REM shutdown /r /t 0