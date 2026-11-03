@echo off
title Nexus HRMS - Automated Snapshot Backup

echo ========================================================
echo       NEXUS ENTERPRISE HRMS - SNAPSHOT BACKUP
echo ========================================================
echo.

cd server
call npm run db:backup
cd ..

echo.
echo [INFO] Backup operation complete. Backups stored in 'backups/' directory.
echo.
pause
