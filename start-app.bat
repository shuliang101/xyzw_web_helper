@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [1/2] Starting backend API...
start "Yinyue Backend" cmd /k "cd /d %ROOT% && npm run server"

echo [2/2] Starting frontend preview (port 8888)...
start "Yinyue Frontend" cmd /k "cd /d %ROOT% && npm run preview -- --host --port 8888"

echo Deployment started. Keep this window open to monitor child processes.
goto :eof

:error
echo Failed to start services. Please review the logs above.
pause
