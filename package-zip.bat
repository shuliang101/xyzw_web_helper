@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "ZIP_NAME=%~1"
if "%ZIP_NAME%"=="" (
    set "ZIP_NAME=xyzw-web-helper-dist.zip"
)
set "ZIP_PATH=%ROOT%%ZIP_NAME%"

if not exist "node_modules" (
    echo [ERROR] Missing local dependencies.
    echo Please run deploy-app.bat or "npm install" first, then re-run this script.
    goto :fail
)

echo [1/3] Building latest production bundle (reuse local deps)...
call "%ROOT%package-app.bat"
if errorlevel 1 goto :error

if not exist "dist" (
    echo [ERROR] Build step did not produce a dist directory.
    goto :error
)

echo [2/3] Removing previous archive "%ZIP_NAME%" (if any)...
if exist "%ZIP_PATH%" (
    del /f /q "%ZIP_PATH%"
    if errorlevel 1 goto :error
)

echo [3/3] Compressing dist -> "%ZIP_NAME%" ...
powershell -NoLogo -NoProfile -Command "Compress-Archive -Path 'dist\*' -DestinationPath '%ZIP_PATH%' -Force" || goto :error

echo Done. Release archive ready at "%ZIP_NAME%".
goto :eof

:error
echo Packaging to zip failed. Please review the logs above.

:fail
pause
exit /b 1
