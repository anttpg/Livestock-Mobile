@echo off
REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo Current directory: %CD%
echo.

echo Killing processes on port 7080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7080') do taskkill /F /PID %%a 2>nul

timeout /t 1

echo Starting log viewer on port 7080...
start "Log Viewer" cmd /c "node logViewer.js"

echo Waiting 1 minute 30 seconds for log viewer to initialize...
timeout /t 90

echo.
echo Log Viewer started: http://localhost:7080
echo.
echo Press any key to close this window...
pause >nul