@echo off
setlocal

cd /d "%~dp0"

if not exist "scripts\dev-up.mjs" (
  echo Chyba: nenasel jsem scripts\dev-up.mjs
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Chyba: Node.js neni v PATH.
  exit /b 1
)

echo Spoustim aplikaci...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo Health:   http://localhost:8000/api/health
echo.

node scripts\dev-up.mjs
