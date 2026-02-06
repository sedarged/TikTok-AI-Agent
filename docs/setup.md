# Setup Guide

Complete setup instructions for TikTok-AI-Agent on macOS, Linux, and Windows.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
  - [macOS](#macos)
  - [Linux](#linux)
  - [Windows](#windows)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running Development Servers](#running-development-servers)
- [Verification](#verification)
- [Common Setup Errors](#common-setup-errors)
- [Next Steps](#next-steps)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Recommended Version | Purpose |
|----------|----------------|---------------------|---------|
| **Node.js** | 20.19.0 | 22.12.0+ | Runtime for server and build tools |
| **npm** | 10.0.0+ | Latest | Package manager |
| **FFmpeg** | 4.4.0+ | 6.0+ | Video composition and encoding |
| **Git** | 2.30+ | Latest | Version control |

### API Keys

- **OpenAI API Key** (required) - Get from [platform.openai.com](https://platform.openai.com/api-keys)
  - Used for: GPT-4 (plan generation), DALL-E 3 (images), Whisper (transcription), TTS (voice-over)
  - Minimum credit: $5 recommended for testing
- **ElevenLabs API Key** (optional) - Get from [elevenlabs.io](https://elevenlabs.io)
  - Used for: Advanced TTS (currently optional)

### System Requirements

- **Disk Space:** 2GB minimum (for dependencies + artifacts)
- **RAM:** 4GB minimum, 8GB recommended
- **OS:** macOS 12+, Ubuntu 20.04+, Windows 10+ (with WSL2 recommended)

---

## Quick Start

For experienced developers on macOS/Linux:

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/TikTok-AI-Agent.git
cd TikTok-AI-Agent

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 4. Setup database
npm run db:generate
npm run db:migrate:dev

# 5. Start development servers
npm run dev
```

Open browser to:
- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health

---

## Detailed Installation

### macOS

#### 1. Install Node.js

**Option A: Using nvm (recommended)**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Restart terminal or source profile
source ~/.zshrc  # or ~/.bash_profile

# Install Node.js 22.12
nvm install 22.12.0
nvm use 22.12.0
nvm alias default 22.12.0

# Verify
node -v  # Should show v22.12.0
npm -v
```

**Option B: Using Homebrew**

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@22

# Verify
node -v
npm -v
```

#### 2. Install FFmpeg

```bash
# Using Homebrew
brew install ffmpeg

# Verify installation
ffmpeg -version
```

#### 3. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/TikTok-AI-Agent.git
cd TikTok-AI-Agent
```

#### 4. Install Dependencies

```bash
npm install
```

This will:
- Install all workspace dependencies (server + web)
- Generate Prisma Client automatically (via `postinstall` hook)

If you encounter EPERM errors on Windows, see [Common Setup Errors](#common-setup-errors).

---

### Linux

#### 1. Install Node.js (Ubuntu/Debian)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Restart terminal or source
source ~/.bashrc

# Install Node.js 22.12
nvm install 22.12.0
nvm use 22.12.0
nvm alias default 22.12.0

# Verify
node -v
npm -v
```

**Alternative: Using apt (Ubuntu 22.04+)**

```bash
# Install Node.js 22.x from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v
npm -v
```

#### 2. Install FFmpeg

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y ffmpeg

# Fedora/RHEL
sudo dnf install -y ffmpeg

# Arch Linux
sudo pacman -S ffmpeg

# Verify
ffmpeg -version
```

#### 3. Install Build Tools (required for native modules)

```bash
# Ubuntu/Debian
sudo apt install -y build-essential python3

# Fedora/RHEL
sudo dnf groupinstall "Development Tools"
sudo dnf install python3

# Arch Linux
sudo pacman -S base-devel python
```

#### 4. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/TikTok-AI-Agent.git
cd TikTok-AI-Agent
npm install
```

---

### Windows

#### 1. Install Node.js

Download and install from [nodejs.org](https://nodejs.org/) (LTS 22.12.0+)

**Or use nvm-windows:**

```powershell
# Download nvm-windows from https://github.com/coreybutler/nvm-windows/releases
# Install nvm-setup.exe

# Open new PowerShell as Administrator
nvm install 22.12.0
nvm use 22.12.0

# Verify
node -v
npm -v
```

#### 2. Install FFmpeg

**Option A: Using Chocolatey (recommended)**

```powershell
# Install Chocolatey (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install FFmpeg
choco install ffmpeg

# Verify (restart PowerShell)
ffmpeg -version
```

**Option B: Manual Installation**

1. Download FFmpeg from [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to PATH:
   - Open System Properties → Environment Variables
   - Edit `Path` → Add `C:\ffmpeg\bin`
4. Restart terminal and verify: `ffmpeg -version`

#### 3. Install Git for Windows

Download from [git-scm.com](https://git-scm.com/download/win)

#### 4. Clone & Install

```powershell
git clone https://github.com/YOUR_USERNAME/TikTok-AI-Agent.git
cd TikTok-AI-Agent
npm install
```

**Note for Windows Users:**

If you encounter EPERM errors during Prisma generation, use the `:only` variants:

```powershell
npm run test:only       # Skip prisma generate
npm run test:render:only
```

See [testing.md (Windows section)](../testing.md (Windows section)) for Windows-specific testing guide.

---

## Database Setup

The application uses **Prisma ORM** with SQLite (development) or PostgreSQL (production).

### Initialize Database

```bash
# Generate Prisma Client (auto-run during npm install)
npm run db:generate

# Run migrations (create database tables)
npm run db:migrate:dev
```

This creates `apps/server/dev.db` with the following tables:
- `Project` - Video projects
- `PlanVersion` - Immutable plan snapshots
- `Scene` - Individual video segments
- `Run` - Render executions
- `Cache` - AI response cache

### Seed Test Data (Optional)

```bash
npm run db:seed
```

This populates the database with sample projects, plans, and scenes for testing.

### Database Studio (Optional)

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555 for visual database inspection.

---

## Configuration

### Create .env File

```bash
cp .env.example .env
```

### Edit .env

```bash
# Required
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Optional - defaults are fine for development
PORT=3001
NODE_ENV=development
DATABASE_URL=file:./dev.db
ELEVENLABS_API_KEY=

# Paths (auto-resolved from repo root)
# MUSIC_LIBRARY_DIR=
# ARTIFACTS_DIR=

# Test modes (optional)
# APP_TEST_MODE=0
# APP_RENDER_DRY_RUN=0
```

### Get OpenAI API Key

1. Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new secret key
3. Copy key (starts with `sk-proj-` or `sk-`)
4. Add to `.env`: `OPENAI_API_KEY=sk-proj-...`

**Cost Estimate:** A 60-second video costs ~$0.50-$1.00 (GPT-4 + DALL-E 3 + TTS + Whisper). See [COST_ANALYSIS_60SEC_VIDEO.md](cost/COST_ANALYSIS_60SEC_VIDEO.md).

---

## Running Development Servers

### Start Both Servers

```bash
npm run dev
```

This runs concurrently:
- **Backend:** http://localhost:3001 (Express API)
- **Frontend:** http://localhost:5173 (Vite dev server with HMR)

### Start Individually

```bash
# Terminal 1 - Backend only
npm run dev:server

# Terminal 2 - Frontend only
npm run dev:web
```

### Development Features

- **Hot Module Replacement (HMR):** Frontend auto-reloads on changes
- **Auto-restart:** Backend restarts on TypeScript changes (via tsx watch)
- **CORS:** Development allows all origins (no `ALLOWED_ORIGINS` needed)
- **Source Maps:** Full TypeScript debugging support

---

## Verification

### 1. Check API Health

```bash
curl http://localhost:3001/api/health
```

**Expected Response:**

```json
{
  "status": "OK",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "artifactsDir": "/path/to/TikTok-AI-Agent/artifacts"
}
```

### 2. Check Provider Status

```bash
curl http://localhost:3001/api/status
```

**Expected Response:**

```json
{
  "providers": {
    "openai": true,
    "elevenlabs": false,
    "ffmpeg": true
  },
  "ready": true,
  "testMode": false,
  "renderDryRun": false,
  "message": "All providers configured and ready."
}
```

**If `openai: false`:**
- Check `OPENAI_API_KEY` in `.env`
- Verify key starts with `sk-proj-` or `sk-`
- Restart server: `npm run dev`

**If `ffmpeg: false`:**
- Install FFmpeg (see [macOS](#macos) / [Linux](#linux) / [Windows](#windows))
- Verify: `ffmpeg -version`
- Restart terminal

### 3. Access Frontend

Open http://localhost:5173 in browser.

**Expected:** Landing page with "Quick Create" form:
- Topic input
- Niche pack dropdown (horror, facts, motivation, etc.)
- Target length slider (30s-180s)

### 4. Create Test Project

1. Enter topic: "5 scariest haunted houses in America"
2. Select niche: "horror"
3. Click "Generate Video Plan"
4. Wait 10-30 seconds for AI plan generation
5. Review generated plan in Plan Studio

**If successful:** Plan shows hook options, outline, script, and scenes.

---

## Common Setup Errors

### Error: `command not found: npm`

**Cause:** Node.js not installed or not in PATH

**Fix:**
```bash
# Verify Node.js installation
node -v
npm -v

# If not found, install Node.js (see OS-specific instructions above)
```

### Error: `ffmpeg: command not found`

**Cause:** FFmpeg not installed

**Fix:**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# Verify
ffmpeg -version
```

### Error: `OPENAI_API_KEY not configured`

**Cause:** Missing or invalid API key

**Fix:**
1. Check `.env` file exists: `ls -la .env`
2. Open `.env` and verify: `OPENAI_API_KEY=sk-proj-...`
3. Restart server: `npm run dev`

### Error: `Port 3001 already in use`

**Cause:** Another process using port 3001

**Fix:**

```bash
# Find process using port
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or change port in .env
PORT=3002
```

### Error: `Cannot find module '@prisma/client'`

**Cause:** Prisma Client not generated

**Fix:**
```bash
npm run db:generate
```

### Error: `Database dev.db does not exist`

**Cause:** Migrations not run

**Fix:**
```bash
npm run db:migrate:dev
```

### Error: `EPERM: operation not permitted` (Windows)

**Cause:** Windows file locking during Prisma generation

**Fix:**
```bash
# Use :only variants that skip prisma generate
npm run test:only
npm run test:render:only

# Or manually generate before tests
npm run db:generate
npm run test:only
```

See [testing.md (Windows section)](../testing.md (Windows section)) for detailed Windows testing guide.

### Error: `Error: P1003: Database dev.db does not exist`

**Cause:** Database file not created

**Fix:**
```bash
# Delete Prisma migrations folder
rm -rf apps/server/prisma/migrations

# Re-run migrations
npm run db:migrate:dev
```

### Error: `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`

**Cause:** Using pnpm instead of npm

**Fix:**
```bash
# This project uses npm workspaces, not pnpm
npm install
npm run dev
```

### Build Error: `Cannot find module 'express'`

**Cause:** Dependencies not installed in workspace

**Fix:**
```bash
# Install all workspace dependencies
npm install

# Or install specific workspace
npm install --workspace=apps/server
npm install --workspace=apps/web
```

---

## Next Steps

### Development Workflow

See [development.md](development.md) for:
- npm scripts reference
- Code structure
- Adding features
- Database migrations
- Testing
- Git workflow

### Testing

Run tests to verify setup:

```bash
# Unit tests (with mocked OpenAI)
npm run test

# Render pipeline tests (dry-run mode, no API calls)
npm run test:render

# E2E tests (Playwright)
npm run test:e2e
```

See [testing.md](testing.md) for complete testing guide.

### Deployment

See [deployment.md](deployment.md) for production deployment:
- Docker
- Railway.app
- AWS/GCP/Azure
- PostgreSQL migration

### Documentation

- [configuration.md](configuration.md) - Environment variables
- [api.md](api.md) - API reference
- [data-model.md](data-model.md) - Database schema
- [security.md](security.md) - Security best practices
- [troubleshooting.md](troubleshooting.md) - Common issues

---

## Support

- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/TikTok-AI-Agent/issues)
- **Discussions:** [GitHub Discussions](https://github.com/YOUR_USERNAME/TikTok-AI-Agent/discussions)
- **Documentation:** [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)

---

**Last Updated:** 2026-01-29  
**Supported OS:** macOS 12+, Ubuntu 20.04+, Windows 10+ (WSL2 recommended)  
**Node.js Version:** 20.19.0+ or 22.12.0+
