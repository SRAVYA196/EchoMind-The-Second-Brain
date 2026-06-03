@echo off
title EchoMind Launcher
color 0b

echo.
echo ================================
echo  EchoMind - Starting Up...
echo ================================
echo.

echo Closing previous instances...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im uvicorn.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1
timeout /t 2 >nul

echo [1/3] Starting Backend...
start "EchoMind Backend" cmd /k "cd /d C:\Users\saisr\Documents\projects\echomind\backend && venv\Scripts\activate && uvicorn main:app --host 127.0.0.1 --port 8000"
timeout /t 8 >nul

echo [2/3] Starting Frontend...
start "EchoMind Frontend" cmd /k "cd /d C:\Users\saisr\Documents\projects\echomind\frontend && npm run dev -- --host 0.0.0.0 --port 3000"
timeout /t 6 >nul

echo [3/3] Starting ngrok...
start "ngrok" cmd /k "cd /d C:\Users\saisr\Documents\projects\echomind && ngrok start --all --config ngrok.yml"
timeout /t 4 >nul

echo.
echo ============================================
echo   EchoMind is READY!
echo ============================================
echo.
start http://localhost:3000
exit