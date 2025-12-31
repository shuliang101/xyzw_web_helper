@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [1/2] Installing dependencies...
call npm install || goto :error

echo [2/2] Building frontend assets...
call npm run build || goto :error

echo Deployment tasks completed. Run start-app.bat to launch the services.
goto :eof

:error
echo Deployment failed. Please review the logs above.
pause
