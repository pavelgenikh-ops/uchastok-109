@echo off
chcp 65001 >nul
title Landshaft 3D - uchastok 109
cd /d "%~dp0"

echo.
echo   Landshaft 3D - SNT "Madio Ozerki", uchastok 109
echo   ------------------------------------------------

if not exist "%~dp0node.exe" (
  echo   [!] Ne naiden node.exe ryadom s etim failom.
  echo       Raspakuite arhiv polnostyu, sohraniv strukturu papok.
  pause
  exit /b 1
)

rem Snyat blokirovku "fail skachan iz interneta" - inache Windows ne zapustit node.exe
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

echo   Zapusk servera...
start "Landshaft 3D server" /min "%~dp0node.exe" "%~dp0server.js"

rem Zhdyom, poka server podnimetsya, i uznayem port
set PORT_FILE=%~dp0.port
if exist "%PORT_FILE%" del "%PORT_FILE%"
for /l %%i in (1,1,20) do (
  if exist "%PORT_FILE%" goto :ready
  timeout /t 1 /nobreak >nul
)

:ready
set APP_PORT=8140
if exist "%PORT_FILE%" set /p APP_PORT=<"%PORT_FILE%"

echo   Adres: http://localhost:%APP_PORT%
echo.

rem Snachala probuem Chrome, inache - brauzer po umolchaniyu
start "" chrome.exe --new-window "http://localhost:%APP_PORT%" 2>nul
if errorlevel 1 start "" "http://localhost:%APP_PORT%"

timeout /t 2 /nobreak >nul
exit /b 0
