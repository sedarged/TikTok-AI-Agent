@echo off
REM Setup script for TikTok-AI-Agent (Windows)
REM Automates first-time setup

echo ========================================
echo TikTok-AI-Agent Setup Script (Windows)
echo ========================================
echo.

REM Check Node version
echo [1/5] Checking Node.js version...
node --version
if %errorlevel% neq 0 (
    echo    ERROR: Node.js not found. Please install Node.js 18+ from https://nodejs.org/
    exit /b 1
)
echo    OK: Node.js found
echo.

REM Check for .env file
echo [2/5] Checking .env file...
if not exist .env (
    echo    Creating .env from .env.example...
    copy .env.example .env
    echo    OK: .env file created
    echo.
    echo    IMPORTANT: Edit .env and add your OPENAI_API_KEY
    echo               Or use dry-run mode by setting APP_RENDER_DRY_RUN=1
    echo.
) else (
    echo    OK: .env file already exists
    echo.
)

REM Install dependencies
echo [3/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo    ERROR: Failed to install dependencies
    exit /b 1
)
echo    OK: Dependencies installed
echo.

REM Setup database
echo [4/5] Setting up database...
cd apps\server
if not exist dev.db (
    echo    Running migrations...
    set DATABASE_URL=file:./dev.db
    call npx prisma migrate deploy
    if %errorlevel% neq 0 (
        echo    ERROR: Failed to run migrations
        cd ..\..
        exit /b 1
    )
    echo    OK: Database created and migrations applied
) else (
    echo    OK: Database already exists
)
cd ..\..
echo.

REM Run checks
echo [5/5] Running checks...
call npm run lint
if %errorlevel% neq 0 (
    echo    WARNING: Lint issues found
) else (
    echo    OK: Lint passed
)

call npm run typecheck
if %errorlevel% neq 0 (
    echo    WARNING: Type errors found
) else (
    echo    OK: Typecheck passed
)

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo Next steps:
echo   1. Edit .env and add your OPENAI_API_KEY (or use dry-run mode)
echo   2. Run 'npm run dev' to start the development server
echo   3. Open http://localhost:5173 in your browser
echo.
echo For testing without API keys:
echo   - Set APP_RENDER_DRY_RUN=1 in .env
echo   - Run 'npm run test' to run tests
echo.
pause
