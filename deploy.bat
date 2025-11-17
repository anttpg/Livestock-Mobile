@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

git config --global --add safe.directory C:/Users/RanchDB/Desktop/RanchDB/Livestock-Mobile
git pull origin main
call npm install
call npm run build

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do taskkill /F /PID %%a 2>nul
timeout /t 2

start "Livestock" /MIN npm start