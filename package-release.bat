@echo off
setlocal

chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "STAGE_DIR=%ROOT%release_bundle"
set "ZIP_NAME=%~1"
if "%ZIP_NAME%"=="" (
    set "ZIP_NAME=xyzw-web-helper-release.zip"
)
set "ZIP_PATH=%ROOT%%ZIP_NAME%"

if not exist "node_modules" (
    echo [ERROR] Missing node_modules. Run npm install first.
    goto :fail
)

echo [1/5] Building latest frontend bundle...
if exist "dist" (
    rmdir /s /q "dist"
    if errorlevel 1 goto :error
)
call npm run build
if errorlevel 1 goto :error

echo [2/5] Preparing release directory...
if exist "%STAGE_DIR%" (
    rmdir /s /q "%STAGE_DIR%"
    if errorlevel 1 goto :error
)
mkdir "%STAGE_DIR%" || goto :error

echo [3/5] Copying runtime files (server + frontend + package manifests)...
call :CopyDir "dist" "%STAGE_DIR%\dist" || goto :error
call :CopyDir "server" "%STAGE_DIR%\server" || goto :error
if not exist "%STAGE_DIR%\server\assets" mkdir "%STAGE_DIR%\server\assets" || goto :error
copy /y "%ROOT%public\answer.json" "%STAGE_DIR%\server\assets\answer.json" >nul || goto :error
if exist "%STAGE_DIR%\server\data" (
    echo    - Removing server data directory from release...
    rmdir /s /q "%STAGE_DIR%\server\data" || goto :error
)
copy /y "%ROOT%package.json" "%STAGE_DIR%" >nul || goto :error
if exist "%ROOT%package-lock.json" copy /y "%ROOT%package-lock.json" "%STAGE_DIR%" >nul
copy /y "%ROOT%run-release.bat" "%STAGE_DIR%" >nul || goto :error
copy /y "%ROOT%runtime.config.json" "%STAGE_DIR%" >nul || goto :error

echo [4/5] Creating zip archive "%ZIP_NAME%"...
if exist "%ZIP_PATH%" (
    del /f /q "%ZIP_PATH%"
    if errorlevel 1 goto :error
)
powershell -NoLogo -NoProfile -Command "Compress-Archive -Path '%STAGE_DIR%\*' -DestinationPath '%ZIP_PATH%' -Force" || goto :error

echo [5/5] Cleaning up temporary release directory...
rmdir /s /q "%STAGE_DIR%" || goto :error

echo Release archive ready at "%ZIP_NAME%".
goto :eof

:CopyDir
robocopy "%~1" "%~2" /MIR >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
    exit /b 1
)
exit /b 0

:error
echo Packaging release failed. Please review the logs above.

:fail
pause
exit /b 1
