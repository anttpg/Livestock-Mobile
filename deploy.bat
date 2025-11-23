@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

git config --global --add safe.directory C:/Users/RanchDB/Desktop/RanchDB/Livestock-Mobile
git pull origin main
call npm install
call npm run build

echo Killing old processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3

REM echo Triggering Task Scheduler to start applications...
REM schtasks /run /tn "Run Livestock Site"

echo Rebooting system in 10 seconds...
echo Press Ctrl+C to cancel
timeout /t 10

shutdown /r /t 0