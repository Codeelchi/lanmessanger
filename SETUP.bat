@echo off
setlocal enabledelayedexpansion
title LAN Chat v0.3.0 - Setup
color 0A

echo.
echo  ============================================
echo   LAN Chat v0.3.0 - Portable Setup
echo  ============================================
echo.

:: Ensure we're in the script's directory
cd /d "%~dp0"

:: Check for runtime\bun.exe
if exist "runtime\bun.exe" (
    echo  [OK] Bun runtime found at runtime\bun.exe
    goto :install_deps
)

echo  [SETUP] Downloading Bun runtime for Windows x64...
echo.

:: Create runtime directory
if not exist "runtime" mkdir runtime

:: Download Bun using PowerShell (available on all modern Windows)
echo  Downloading bun-windows-x64.zip ...
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip'; $out = '%~dp0runtime\bun-windows-x64.zip'; Write-Host '  URL: ' $url; $wc = New-Object System.Net.WebClient; $wc.DownloadFile($url, $out); Write-Host '  Download complete.' }"

if not exist "runtime\bun-windows-x64.zip" (
    echo  [ERROR] Failed to download Bun runtime!
    echo  Please download manually from:
    echo  https://github.com/oven-sh/bun/releases/latest
    echo  Extract bun.exe to the runtime\ folder.
    pause
    exit /b 1
)

:: Extract using PowerShell
echo  Extracting bun.exe ...
powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('%~dp0runtime\bun-windows-x64.zip'); $entry = $zip.Entries | Where-Object { $_.FullName -like '*bun.exe' -and $_.FullName -notlike '*bunx*' } | Select-Object -First 1; if ($entry) { [System.IO.Compression.FileStream]::new('%~dp0runtime\bun.exe', [System.IO.FileMode]::Create) | ForEach-Object { $entry.Open().CopyTo($_); $_.Close() } }; $zip.Dispose() }"

:: Clean up zip
del /f "runtime\bun-windows-x64.zip" 2>nul

if not exist "runtime\bun.exe" (
    echo  [ERROR] Failed to extract bun.exe!
    echo  Please manually extract bun.exe from the downloaded zip
    echo  and place it in the runtime\ folder.
    pause
    exit /b 1
)

echo  [OK] Bun runtime extracted successfully
echo.

:install_deps
echo  [SETUP] Installing dependencies...
echo.
call runtime\bun.exe install
if errorlevel 1 (
    echo  [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo.

echo  [SETUP] Generating Prisma client...
echo.
call runtime\bun.exe run db:generate
if errorlevel 1 (
    echo  [WARN] Prisma generate had issues, trying db:push...
    call runtime\bun.exe run db:push
)
echo.

echo  [SETUP] Building Next.js application...
echo.
call runtime\bun.exe run build
if errorlevel 1 (
    echo  [ERROR] Build failed!
    echo  Check the output above for errors.
    pause
    exit /b 1
)
echo.

:: Create data directory
if not exist "data" mkdir data

:: Create empty SQLite database if it doesn't exist
if not exist "data\custom.db" (
    echo  [SETUP] Creating empty database...
    type nul > data\custom.db
)

:: Create uploads directory
if not exist "public\uploads" mkdir public\uploads

echo.
echo  ============================================
echo   SETUP COMPLETE!
echo  ============================================
echo.
echo  Run START.bat to launch LAN Chat.
echo  The app will open at http://localhost:3000
echo.
echo  LAN Bridge will automatically discover other
echo  LAN Messenger users on UDP port 50000.
echo.
pause
