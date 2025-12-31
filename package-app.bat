@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "node_modules" (
    echo [ERROR] Missing local dependencies.
    echo Please run deploy-app.bat or "npm install" first, then re-run this script.
    goto :fail
)

echo [1/2] Cleaning previous build artifacts...
if exist "dist" (
    rmdir /s /q "dist"
    if errorlevel 1 goto :error
)

echo [2/2] Building production bundle (no dependency download)...
call npm run build
if errorlevel 1 goto :error

echo Packaging complete. Optimized files are under the dist directory.
goto :eof

:error
echo Packaging failed. Please review the logs above.

:fail
pause
exit /b 1
