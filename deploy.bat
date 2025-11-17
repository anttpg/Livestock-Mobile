@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

echo Pulling latest code...
git config --global --add safe.directory C:/Users/RanchDB/Desktop/RanchDB/Livestock-Mobile
git pull origin main

echo Installing dependencies...
call npm install

echo Building production frontend...
call npm run build

echo Restarting applications...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do taskkill /F /PID %%a 2>nul
timeout /t 2
start "Livestock-Backend" /MIN node backend/sessionManager.js
timeout /t 3
cd frontend
start "Livestock-Frontend" /MIN node ../node_modules/vite/bin/vite.js preview --port 8080 --host
cd ..

echo Deployment complete!