@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

git config --global --add safe.directory C:/Users/RanchDB/Desktop/RanchDB/Livestock-Mobile
git pull origin main
call npm install
call npm run build

echo Killing old processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3

echo Starting applications...
start "Livestock" /MIN npm start