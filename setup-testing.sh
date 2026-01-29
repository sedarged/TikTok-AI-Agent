#!/bin/bash

set -e  # Exit on error

echo "🚀 TikTok AI Agent - Complete Testing Setup"
echo "=========================================="
echo ""

# Step 1: Install dependencies
echo "📦 Step 1/6: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 2: Generate Prisma client
echo "🔧 Step 2/6: Generating Prisma client..."
npm run db:generate
echo "✅ Prisma client generated"
echo ""

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:./app.db"
fi

# Step 3: Create/reset database
echo "🗄️  Step 3/6: Creating database schema..."
npm run db:migrate:dev
echo "✅ Database schema created"
echo ""

# Step 4: Seed test data
echo "🌱 Step 4/6: Seeding test data..."
npm run db:seed
echo "✅ Test data seeded"
echo ""

# Step 5: Run tests
echo "🧪 Step 5/6: Running backend tests..."
npm run test
echo "✅ Tests passed"
echo ""

# Step 6: Start dev environment
echo "🎉 Step 6/6: Starting development server..."
echo ""
echo "Frontend will be available at: http://localhost:5173"
echo "Backend API will be available at: http://localhost:3001/api"
echo ""
npm run dev
