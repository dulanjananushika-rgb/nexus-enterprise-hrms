@echo off
title Nexus HRMS (Development Mode)
cd /d "%~dp0"
start "Nexus HRMS Backend" cmd /k "cd server && npm run dev"
start "Nexus HRMS Frontend" cmd /k "cd client && npm run dev"
echo Both Frontend (http://localhost:5173) and Backend (http://localhost:5000) are starting...
