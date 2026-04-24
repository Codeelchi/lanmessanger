@echo off
setlocal
title LAN Chat v0.3.0
color 0B

:: Ensure we're in the script's directory
cd /d "%~dp0"

:: Check if setup has been run (node_modules must exist)
if not exist "node_modules" (
    echo  [START] Dependencies not found. Running SETUP first...
    echo.
    call "%~dp0SETUP.bat"
    if errorlevel 1 (
        echo  [ERROR] Setup failed. Cannot start.
        pause
        exit /b 1
    )
)

:: Check if .next build output exists
if not exist ".next" (
    echo  [START] Build not found. Running SETUP first...
    echo.
    call "%~dp0SETUP.bat"
    if errorlevel 1 (
        echo  [ERROR] Setup failed. Cannot start.
        pause
        exit /b 1
    )
)

:: Check runtime
if not exist "runtime\bun.exe" (
    echo  [ERROR] runtime\bun.exe not found! Run SETUP.bat first.
    pause
    exit /b 1
)

:: Ensure data directory and database exist
if not exist "data" mkdir data
if not exist "data\custom.db" type nul > data\custom.db

echo.
echo  ============================================
echo   LAN Chat v0.3.0 - Starting...
echo  ============================================
echo.
echo  Web UI:    http://localhost:3000
echo  LAN Bridge: UDP port 50000
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Start the production server
:: instrumentation.ts will auto-create DB tables and start LAN Bridge
call runtime\bun.exe run start:prod

:: If server exits unexpectedly
echo.
echo  [LAN Chat] Server has stopped.
pause
