@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do taskkill /F /PID %%a 2>nul
timeout /t 2
start "Livestock-Backend" /MIN node backend/sessionManager.js
timeout /t 3
cd frontend
start "Livestock-Frontend" /MIN node ../node_modules/vite/bin/vite.js preview --port 8080 --host
cd ..