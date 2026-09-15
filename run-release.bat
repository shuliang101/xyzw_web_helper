@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not "%~1"=="" (
    set "SERVER_PORT=%~1"
)

if not "%~2"=="" (
    for %%I in ("%~2") do set "DATA_DIR=%%~fI"
)

if not exist "dist" (
    echo [ERROR] Missing dist directory. Run package-release.bat first.
    goto :fail
)

if not exist "node_modules" (
    echo Dependencies not found. Installing production dependencies...
    call npm install --omit=dev
    if errorlevel 1 goto :error
)

echo Starting XYZW helper (backend + static frontend)...
echo   Config file: %ROOT%runtime.config.json
if defined SERVER_PORT echo   SERVER_PORT override=%SERVER_PORT%
if defined DATA_DIR echo   DATA_DIR override=%DATA_DIR%
node server/index.js
if errorlevel 1 goto :error
goto :eof

:error
echo Application exited with an error. Check the logs above.

:fail
pause
exit /b 1
