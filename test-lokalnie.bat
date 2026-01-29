@echo off
setlocal enabledelayedexpansion

echo ========================================
echo 🧪 Testowanie Lokalne - TikTok AI Agent
echo ========================================
echo.

echo Wybierz opcję:
echo.
echo 1. Pełna instalacja i testy (automatycznie wszystko)
echo 2. Tylko testy backendu
echo 3. Tylko uruchomienie serwerów (dev)
echo 4. Testy E2E (wymaga uruchomionych serwerów)
echo 5. Sprawdź konfigurację
echo 6. Wyjście
echo.

set /p choice="Wybierz numer (1-6): "

if "%choice%"=="1" goto full_setup
if "%choice%"=="2" goto backend_tests
if "%choice%"=="3" goto dev_servers
if "%choice%"=="4" goto e2e_tests
if "%choice%"=="5" goto check_config
if "%choice%"=="6" goto end
goto invalid_choice

:full_setup
echo.
echo 🚀 Uruchamianie pełnej instalacji...
call setup-testing.bat
goto end

:backend_tests
echo.
echo 🧪 Uruchamianie testów backendu...
call npm run test
if errorlevel 1 (
  echo.
  echo ❌ Testy nie przeszły! Sprawdź błędy powyżej.
) else (
  echo.
  echo ✅ Wszystkie testy przeszły pomyślnie!
)
goto end

:dev_servers
echo.
echo 🎉 Uruchamianie serwerów deweloperskich...
echo.
echo Frontend będzie dostępny na: http://localhost:5173
echo Backend API będzie dostępny na: http://localhost:3001/api
echo.
echo Naciśnij Ctrl+C aby zatrzymać serwery.
echo.
call npm run dev
goto end

:e2e_tests
echo.
echo 🔍 Uruchamianie testów E2E...
echo.
echo UWAGA: Upewnij się, że serwery są uruchomione w innym terminalu!
echo Jeśli nie, uruchom najpierw opcję 3.
echo.
pause
call npm run test:e2e
if errorlevel 1 (
  echo.
  echo ❌ Testy E2E nie przeszły!
) else (
  echo.
  echo ✅ Wszystkie testy E2E przeszły pomyślnie!
)
goto end

:check_config
echo.
echo 🔍 Sprawdzanie konfiguracji...
echo.

echo Sprawdzanie Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js nie jest zainstalowany!
) else (
  node --version
  echo ✅ Node.js jest zainstalowany
)
echo.

echo Sprawdzanie npm...
where npm >nul 2>&1
if errorlevel 1 (
  echo ❌ npm nie jest zainstalowany!
) else (
  npm --version
  echo ✅ npm jest zainstalowany
)
echo.

echo Sprawdzanie zależności...
if exist "node_modules\" (
  echo ✅ node_modules istnieje
) else (
  echo ⚠️  node_modules nie istnieje - uruchom: npm install
)
echo.

echo Sprawdzanie bazy danych...
if exist "apps\server\app.db" (
  echo ✅ Baza danych istnieje
) else (
  echo ⚠️  Baza danych nie istnieje - uruchom: npm run db:migrate:dev
)
echo.

echo Sprawdzanie plików .env.local...
if exist "apps\server\.env.local" (
  echo ✅ apps/server/.env.local istnieje
) else (
  echo ⚠️  apps/server/.env.local nie istnieje
)
if exist "apps\web\.env.local" (
  echo ✅ apps/web/.env.local istnieje
) else (
  echo ⚠️  apps/web/.env.local nie istnieje
)
echo.

goto end

:invalid_choice
echo.
echo ❌ Nieprawidłowy wybór! Wybierz numer od 1 do 6.
echo.
pause
goto end

:end
echo.
echo Gotowe!
pause
