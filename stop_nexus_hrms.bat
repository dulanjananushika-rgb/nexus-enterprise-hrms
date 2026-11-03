@echo off
setlocal enabledelayedexpansion
title Nexus HRMS - Shutdown

echo ========================================================
echo        NEXUS ENTERPRISE HRMS - SYSTEM SHUTDOWN
echo ========================================================
echo.

set STOPPED=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    set PID_TO_KILL=%%a
    if defined PID_TO_KILL (
        echo [INFO] Stopping Nexus HRMS process (PID: !PID_TO_KILL!)...
        taskkill /F /PID !PID_TO_KILL! >nul 2>nul
        set STOPPED=1
    )
)

if "%STOPPED%"=="1" (
    echo [SUCCESS] Nexus HRMS server has been gracefully stopped.
) else (
    echo [INFO] No active Nexus HRMS server was detected on port 5000.
)

echo.
timeout /t 3 >nul
