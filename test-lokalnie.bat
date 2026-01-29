@echo off
setlocal enabledelayedexpansion

rem TikTok AI Agent - local runner / tests helper (Windows)

echo ========================================
echo Testowanie Lokalne - TikTok AI Agent
echo ========================================
echo.
echo Wybierz opcje:
echo.
echo 1. Pelna instalacja i testy (setup-testing.bat)
echo 2. Tylko testy backendu (npm run test)
echo 3. Uruchom serwery (dev) - klasycznie (npm run dev)
echo 3a. Uruchom serwery (dev) - osobne okna (bez concurrently) + DRY-RUN
echo 4. Testy E2E (npm run test:e2e)
echo 5. Sprawdz konfiguracje
echo 6. Wyjscie
echo.

set "choice="
set /p choice="Wybierz numer (1-6 lub 3a): "

if "%choice%"=="1" goto full_setup
if "%choice%"=="2" goto backend_tests
if "%choice%"=="3" goto dev_servers
if /I "%choice%"=="3a" goto dev_servers_split_dryrun
if "%choice%"=="4" goto e2e_tests
if "%choice%"=="5" goto check_config
if "%choice%"=="6" goto end_ok
goto invalid_choice

:full_setup
echo.
echo Uruchamianie pelnej instalacji...
call setup-testing.bat
goto end_pause

:backend_tests
echo.
echo Uruchamianie testow backendu...
call npm run test
if errorlevel 1 (
  echo.
  echo Testy nie przeszly! Sprawdz bledy powyzej.
) else (
  echo.
  echo OK: wszystkie testy backendu przeszly.
)
goto end_pause

:dev_servers
echo.
echo Uruchamianie serwerow deweloperskich...
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001/api
echo.
echo Nacisnij Ctrl+C aby zatrzymac serwery.
echo.
call npm run dev
goto end_pause

:dev_servers_split_dryrun
echo.
echo Uruchamianie serwerow (osobne okna) + DRY-RUN...
echo Ten tryb omija "concurrently" (pomaga przy bledzie spawn EPERM).
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001/api
echo.

for /f %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo Wykryty Node.js: %NODE_VER%
echo %NODE_VER% | findstr /b /i "v24" >nul
if not errorlevel 1 (
  echo UWAGA: Node v24 moze powodowac spawn EPERM. Zalecany Node 20 LTS.
)

set "APP_TEST_MODE=0"
set "APP_RENDER_DRY_RUN=1"
set "NODE_ENV=development"

echo.
echo Otwieram osobne okna CMD dla server i web...
echo.
start "TikTok AI - server (dry-run)" cmd /k "cd /d %~dp0apps\server && npm run dev"
start "TikTok AI - web (dry-run)" cmd /k "cd /d %~dp0apps\web && npm run dev"
echo.
echo OK. Zamknij oba okna CMD aby zatrzymac serwery.
goto end_pause

:e2e_tests
echo.
echo Uruchamianie testow E2E...
echo.
echo Uwaga: Playwright moze wymagac instalacji przegladarek:
echo   npx playwright install
echo.
call npm run test:e2e
if errorlevel 1 (
  echo.
  echo Testy E2E nie przeszly.
) else (
  echo.
  echo OK: wszystkie testy E2E przeszly.
)
goto end_pause

:check_config
echo.
echo Sprawdzanie konfiguracji...
echo.

echo Node.js:
where node >nul 2>&1
if errorlevel 1 (
  echo  - BRAK (zainstaluj Node.js 18/20 LTS)
) else (
  for /f %%v in ('node --version') do echo  - %%v
)

echo npm:
where npm >nul 2>&1
if errorlevel 1 (
  echo  - BRAK
) else (
  for /f %%v in ('npm --version') do echo  - %%v
)

echo.
echo node_modules:
if exist "node_modules\" (
  echo  - OK
) else (
  echo  - BRAK (uruchom: npm install)
)

echo.
echo Gotowe.
goto end_pause

:invalid_choice
echo.
echo Nieprawidlowy wybor. Wybierz 1-6 lub 3a.
goto end_pause

:end_ok
echo.
echo Wyjscie.
goto :eof

:end_pause
echo.
pause
goto :eof
