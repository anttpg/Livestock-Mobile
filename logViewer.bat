@echo off
REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] [STARTUPLOGGER] Working directory: %CD%
git config --global --add safe.directory %CD%

echo [%TIME%] [STARTUPLOGGER] Pulling latest changes from git...
git pull origin main

echo [%TIME%] [STARTUPLOGGER] Installing npm dependencies...
call npm install

echo [%TIME%] [STARTUPLOGGER] Building application...
call npm run build

echo [%TIME%] [STARTUPLOGGER] Killing old node.exe processes...
taskkill /F /IM node.exe 2>nul

echo [%TIME%] [STARTUPLOGGER] Waiting 3 seconds...
ping 127.0.0.1 -n 4 > nul

echo [%TIME%] [STARTUPLOGGER] Killing processes on ports 3000, 7080, and 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo [%TIME%] [STARTUPLOGGER] Killing process on port 3000 (PID %%a)
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7080') do (
    echo [%TIME%] [STARTUPLOGGER] Killing process on port 7080 (PID %%a)
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do (
    echo [%TIME%] [STARTUPLOGGER] Killing process on port 8080 (PID %%a)
    taskkill /F /PID %%a 2>nul
)

echo [%TIME%] [STARTUPLOGGER] Waiting 3 seconds...
ping 127.0.0.1 -n 4 > nul

echo [%TIME%] [STARTUPLOGGER] Starting backend on port 3000...
start "Backend" cmd /c "npm run backend"

echo [%TIME%] [STARTUPLOGGER] Waiting 2 seconds...
ping 127.0.0.1 -n 4 > nul

echo [%TIME%] [STARTUPLOGGER] Starting frontend on port 8080...
start "Frontend" cmd /c "npm run frontend"

echo [%TIME%] [STARTUPLOGGER] Waiting 2 seconds...
ping 127.0.0.1 -n 4 > nul

echo [%TIME%] [STARTUPLOGGER] Starting log viewer on port 7080...
start "Log Viewer" cmd /c "node logViewer.js"

echo [%TIME%] [STARTUPLOGGER] Waiting 90 seconds for services to initialize...
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul
ping 127.0.0.1 -n 4 > nul

echo [%TIME%] [STARTUPLOGGER] Startup complete