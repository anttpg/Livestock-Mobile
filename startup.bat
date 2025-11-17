@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

echo Killing old processes...
taskkill /F /IM node.exe 2>nul

echo Killing processes on ports 3000 and 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /F /PID %%a 2>nul

timeout /t 3

echo Starting applications...
start "Livestock" npm start