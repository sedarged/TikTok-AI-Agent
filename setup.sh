#!/bin/bash
# Setup script for TikTok-AI-Agent
# Automates first-time setup

set -e

echo "🚀 TikTok-AI-Agent Setup Script"
echo "================================"
echo ""

# Check Node version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "   Found: $NODE_VERSION"

if ! node -e "process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)"; then
    echo "   ❌ Error: Node.js 18+ required"
    exit 1
fi
echo "   ✅ Node.js version OK"
echo ""

# Check for .env file
echo "📋 Checking .env file..."
if [ ! -f .env ]; then
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo "   ✅ .env file created"
    echo ""
    echo "   ⚠️  IMPORTANT: Edit .env and add your OPENAI_API_KEY"
    echo "      Or use dry-run mode by setting APP_RENDER_DRY_RUN=1"
    echo ""
else
    echo "   ✅ .env file already exists"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "   ✅ Dependencies installed"
echo ""

# Setup database
echo "🗄️  Setting up database..."
cd apps/server
if [ ! -f dev.db ]; then
    echo "   Running migrations..."
    DATABASE_URL="file:./dev.db" npx prisma migrate deploy
    echo "   ✅ Database created and migrations applied"
else
    echo "   ✅ Database already exists"
fi
cd ../..
echo ""

# Run checks
echo "🔍 Running checks..."
npm run lint
echo "   ✅ Lint passed"

npm run typecheck
echo "   ✅ Typecheck passed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add your OPENAI_API_KEY (or use dry-run mode)"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Open http://localhost:5173 in your browser"
echo ""
echo "For testing without API keys:"
echo "  - Set APP_RENDER_DRY_RUN=1 in .env"
echo "  - Run 'npm run test' to run tests"
echo ""
