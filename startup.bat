@echo off
REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo Current directory: %CD%
echo.

echo Killing old processes...
taskkill /F /IM node.exe 2>nul

echo Killing processes on ports 3000 and 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /F /PID %%a 2>nul

timeout /t 3

REM Load LOCAL_PATH from .env and strip quotes
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if "%%a"=="LOCAL_PATH" (
            set "LOCAL_PATH=%%b"
        )
    )
) else (
    echo ERROR: .env file not found!
    pause
    exit /b 1
)

REM Remove quotes from LOCAL_PATH
set LOCAL_PATH=%LOCAL_PATH:"=%

REM Verify LOCAL_PATH exists
if not exist "%LOCAL_PATH%" (
    echo ERROR: LOCAL_PATH directory does not exist: %LOCAL_PATH%
    pause
    exit /b 1
)

REM Create log files if they don't exist
if not exist "%LOCAL_PATH%\backend.log" type nul > "%LOCAL_PATH%\backend.log"
if not exist "%LOCAL_PATH%\frontend.log" type nul > "%LOCAL_PATH%\frontend.log"

echo Starting applications with logging...

echo Starting backend on port 3000...
start "Backend" cmd /c "npm run backend > "%LOCAL_PATH%\backend.log" 2>&1"
timeout /t 2

echo Starting frontend on port 8080...
start "Frontend" cmd /c "npm run frontend > "%LOCAL_PATH%\frontend.log" 2>&1"

echo.
echo Applications started:
echo Backend: Port 3000
echo Frontend: Port 8080
echo.
echo Logs saved to:
echo Backend: %LOCAL_PATH%\backend.log
echo Frontend: %LOCAL_PATH%\frontend.log
echo.
echo Press any key to close this window...
pause >nul