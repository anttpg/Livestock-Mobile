@echo off
REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] Working directory: %CD%
echo.

echo [%TIME%] Killing any running Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2
echo.


echo [%TIME%] Removing broken node_modules...
if exist node_modules (
    echo [%TIME%] Removing root node_modules...
    rmdir /s /q node_modules
    echo [%TIME%] Root node_modules removed
) else (
    echo [%TIME%] No root node_modules found
)


echo [%TIME%] Removing package-lock.json if it exists...
if exist package-lock.json (
    del /f package-lock.json
    echo [%TIME%] package-lock.json removed
) else (
    echo [%TIME%] No package-lock.json found
)
echo.