@echo off
setlocal enabledelayedexpansion

echo 🚀 TikTok AI Agent - Complete Testing Setup
echo ==========================================
echo.

echo 📦 Step 1/6: Installing dependencies...
call npm install
if errorlevel 1 (
  echo ❌ Dependencies installation failed
  exit /b 1
)
echo ✅ Dependencies installed
echo.

echo 🔧 Step 2/6: Generating Prisma client...
call npm run db:generate
if errorlevel 1 (
  echo ❌ Prisma client generation failed
  exit /b 1
)
echo ✅ Prisma client generated
echo.

if "%DATABASE_URL%"=="" (
  set "DATABASE_URL=file:./app.db"
)

echo 🗄️  Step 3/6: Creating database schema...
call npm run db:migrate:dev
if errorlevel 1 (
  echo ❌ Database migration failed
  exit /b 1
)
echo ✅ Database schema created
echo.

echo 🌱 Step 4/6: Seeding test data...
call npm run db:seed
if errorlevel 1 (
  echo ❌ Database seeding failed
  exit /b 1
)
echo ✅ Test data seeded
echo.

echo 🧪 Step 5/6: Running backend tests...
call npm run test
if errorlevel 1 (
  echo ❌ Tests failed
  exit /b 1
)
echo ✅ Tests passed
echo.

echo 🎉 Step 6/6: Starting development server...
echo.
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:3001/api
echo.
call npm run dev
