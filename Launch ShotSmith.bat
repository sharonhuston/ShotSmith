@echo off
title ShotSmith

REM Run from the folder where this .bat lives (portable — no hardcoded drive paths).
cd /d "%~dp0"

REM Windows cannot assign an icon to a .bat file. Shortcut goes in _local\ (gitignored).
if exist "ShotSmith.ico" if not exist "_local\Launch ShotSmith.lnk" (
  if not exist "_local" mkdir "_local"
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Create-LauncherShortcut.ps1" >nul 2>&1
)

if not exist "package.json" (
  echo This launcher must stay in the ShotSmith project folder ^(next to package.json^).
  pause
  exit /b 1
)

REM --- Optional: customize for your PC (uncomment and edit; leave commented for GitHub clone) ---
REM If Node/npm is not on PATH, add your install folder:
REM set "PATH=C:\Program Files\nodejs;%PATH%"
REM If you moved the repo, force the project directory:
REM cd /d "D:\Projects\ShotSmith"
REM Open a specific browser instead of the default:
REM start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:5173/
REM Pin a fixed dev URL/port after Vite starts (only if you always use the same port):
REM timeout /t 3 /nobreak >nul
REM start "" http://localhost:5173/

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm was not found in PATH. Install from https://nodejs.org
  echo Or uncomment the PATH= line above and point to your Node install.
  pause
  exit /b 1
)

echo Starting dev server and browser...
call npm run dev -- --open

if errorlevel 1 (
  echo.
  echo Something went wrong. See messages above.
  pause
)
