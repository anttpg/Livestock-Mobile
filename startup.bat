@echo off
cd "C:\Users\RanchDB\Desktop\RanchDB\Livestock-Mobile"
call pm2 delete all
call pm2 start ecosystem.config.js
call pm2 save