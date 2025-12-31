@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "dist" (
    echo [ERROR] Missing dist directory. Run package-app.bat or package-release.bat first.
    goto :fail
)

if not exist "node_modules" (
    echo [ERROR] Missing node_modules. Install dependencies or bundle them before running this script.
    goto :fail
)

echo Starting XYZW helper (backend + static frontend)...
node server/index.js
if errorlevel 1 goto :error
goto :eof

:error
echo Application exited with an error. Check the logs above.

:fail
pause
exit /b 1
