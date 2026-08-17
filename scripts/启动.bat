@echo off
setlocal
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "DSH_HOME=%APP_DIR%\profile\.dsh-runtime"
rem If the app folder is not writable (e.g. installed under Program Files),
rem keep the runtime profile in the user's LOCALAPPDATA instead.
set "WRITABLE=1"
> "%APP_DIR%\.dsh-wtest" 2>nul || set "WRITABLE=0"
if exist "%APP_DIR%\.dsh-wtest" del "%APP_DIR%\.dsh-wtest" >nul 2>&1
if "%WRITABLE%"=="0" set "DSH_HOME=%LOCALAPPDATA%\DeepSeek Harness\profile\.dsh-runtime"
set "ELECTRON_RUN_AS_NODE=1"
"%APP_DIR%\DeepSeek Harness.exe" --expose-internals "%APP_DIR%\modules\dsh-community-plugins\scripts\portable-fixup.mjs" "%APP_DIR%"
if errorlevel 1 (
  echo Initialization failed. See the error above.
  pause
  exit /b 1
)
set "ELECTRON_RUN_AS_NODE="
start "" "%APP_DIR%\DeepSeek Harness.exe"
