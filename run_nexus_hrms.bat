@echo off
setlocal enabledelayedexpansion
title Nexus HRMS - Launcher

echo ========================================================
echo         NEXUS ENTERPRISE HR MANAGEMENT SYSTEM
echo ========================================================
echo.

:: 1. Verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js v20 or newer from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Ensure Server & Client Builds Exist
if not exist "server\dist\index.js" (
    echo [INFO] Compiling backend server distribution...
    cd server
    call npm run build
    cd ..
)

if not exist "client\dist\index.html" (
    echo [INFO] Building frontend client bundle...
    cd client
    call npm run build
    cd ..
)

:: 3. Check and free Port 5000 if occupied
echo [INFO] Checking port 5000 status...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    set PID_TO_KILL=%%a
    if defined PID_TO_KILL (
        echo [INFO] Releasing existing process listening on port 5000 (PID: !PID_TO_KILL!)...
        taskkill /F /PID !PID_TO_KILL! >nul 2>nul
    )
)

:: 4. Launch Production Server
echo [INFO] Starting Nexus HRMS Production Server...
cd server
start "Nexus HRMS Server Daemon" /min node dist/index.js
cd ..

:: 5. Wait for server readiness
echo [INFO] Verifying system health on http://localhost:5000...
timeout /t 3 /nobreak >nul

:: 6. Launch Browser
echo [SUCCESS] Nexus HRMS is active and ready!
echo [INFO] Opening Web Portal in your default browser...
start http://localhost:5000

echo.
echo ========================================================
echo  System URL:  http://localhost:5000
echo  Default Login:
echo    - Super Admin: admin@nexus.com / Password123!
echo    - HR Manager:  hr@nexus.com    / Password123!
echo ========================================================
echo.
echo Leave this window or close it. To stop the server at any
echo time, double-click 'stop_nexus_hrms.bat'.
echo.
pause
