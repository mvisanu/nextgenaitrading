@echo off
title Politician Copy Trader - LIVE
cd /d C:\Users\Bruce\source\repos\NextgenAiTrading\politician-copy-trading

:loop
echo [%date% %time%] Starting politician copy trader (LIVE)...
C:\Python311\python.exe main.py
echo [%date% %time%] Bot exited. Restarting in 30 seconds...
timeout /t 30 /nobreak
goto loop
