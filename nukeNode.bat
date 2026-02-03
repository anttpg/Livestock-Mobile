@echo off
REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [%TIME%] Working directory: %CD%
echo.

echo [%TIME%] Step 1: Pulling latest changes from git...
git fetch origin main
git reset --hard origin/main
echo [%TIME%] Git updated successfully
echo.

echo [%TIME%] Step 2: Removing broken node_modules...
if exist node_modules (
    echo [%TIME%] Removing root node_modules...
    rmdir /s /q node_modules
    echo [%TIME%] Root node_modules removed
) else (
    echo [%TIME%] No root node_modules found
)


echo [%TIME%] Step 3: Removing package-lock.json if it exists...
if exist package-lock.json (
    del /f package-lock.json
    echo [%TIME%] package-lock.json removed
) else (
    echo [%TIME%] No package-lock.json found
)
echo.


echo [%TIME%] Step 4: Clean installing dependencies from lock file...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] ERROR: npm install failed!
    pause
    exit /b 1
)
echo [%TIME%] Dependencies installed successfully
echo.

echo [%TIME%] Step 5: Building application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] ERROR: Build failed!
    pause
    exit /b 1
)
echo [%TIME%] Build completed successfully
echo.
