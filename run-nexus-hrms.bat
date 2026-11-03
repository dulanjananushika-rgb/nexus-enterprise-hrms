@echo off
title Nexus HRMS - Enterprise Human Resource Suite
echo ===================================================================
echo Starting Nexus HRMS Production Environment...
echo URL: http://localhost:5000
echo ===================================================================

cd /d "%~dp0"
node server/dist/index.js
pause
