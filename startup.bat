@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"

echo Killing old processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3

echo Starting applications...
start "Livestock" npm start