# TikTok AI - Video Generator

A full-stack web application that generates TikTok-style vertical videos end-to-end using AI.

**Topic → PLAN & PREVIEW (editable) → APPROVE & RENDER → Real MP4 file**

**Wiele dokumentów?** Zobacz **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** – tam jest mapa: który plik jest główny (DEVELOPMENT_MASTER_PLAN), co dla AI (AGENTS.md), co dla testów, plany w `.cursor/plans/`.

## Features

- **AI-Powered Content Generation**: Uses OpenAI GPT-4 for script writing, DALL-E 3 for image generation, TTS for voice-over, and Whisper for caption timing
- **12 Niche Packs**: Pre-configured styles for horror, facts, motivation, product, story, top5, finance, health, history, gaming, science, mystery
- **Full Plan & Preview Studio**: Edit hooks, outline, script, and individual scenes before rendering
- **Real Video Output**: Generates actual MP4 files with motion effects, captions, and audio
- **Progress Tracking**: Real-time SSE updates during rendering with detailed logs
- **Retry/Resume**: Idempotent pipeline that can resume from failed steps
- **Artifact Verification**: Validates all output files before marking as complete

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite + Prisma
- **Video**: FFmpeg for rendering
- **AI**: OpenAI (GPT-4, DALL-E 3, TTS, Whisper)

## Quick Start

### Option A: GitHub Codespaces (Best for Mobile Testing)

The easiest way to run this app and access it from your phone:

1. **Open in Codespaces:**
   - Go to your repo on GitHub
   - Click **Code** → **Codespaces** → **Create codespace**

2. **Setup (in Codespace terminal):**

   ```bash
   # Dependencies are auto-installed, just add your API key:
   echo "OPENAI_API_KEY=sk-your-key-here" >> .env

   # Start the app
   npm run dev
   ```

3. **Access on your phone:**
   - Click the **Ports** tab at the bottom of Codespaces
   - Right-click port `5173` → **Port Visibility** → **Public**
   - Copy the URL (e.g., `https://xxx-5173.app.github.dev`)
   - Open that URL on your phone!

---

### Option B: Local Installation

#### 1. Prerequisites

- Node.js 18+
- FFmpeg installed on your system (or the app will use ffmpeg-static)
- OpenAI API key (required for real AI generation; dry-run works without it)

#### 2. Installation

**Quick Setup (Recommended):**

```bash
# Clone the repository
git clone https://github.com/sedarged/TikTok-AI-Agent.git
cd TikTok-AI-Agent

# Run setup script (Linux/Mac)
./setup.sh

# Or on Windows
setup.bat

# Edit .env and add your OpenAI API key (or use dry-run mode)
# OPENAI_API_KEY=sk-...

# Start development servers
npm run dev
```

**Manual Setup:**

```bash
# Clone the repository
git clone https://github.com/sedarged/TikTok-AI-Agent.git
cd TikTok-AI-Agent

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-...

# Setup database (from apps/server directory)
cd apps/server
DATABASE_URL="file:./dev.db" npx prisma migrate deploy
cd ../..

# Start development servers
npm run dev
```

#### 3. Access the App

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Production notes (env vars)

- **DATABASE_URL**: set this explicitly for production deployments (SQLite file or PostgreSQL). Do not rely on the default.
- **ALLOWED_ORIGINS**: must be set in production, otherwise browser requests will be blocked by CORS.
- **OPENAI_API_KEY**: required for AI features; if missing you can still use template mode and/or dry-run render.

### Local PC (Dry-Run only, no API keys)

This runs the full render pipeline without OpenAI/FFmpeg:

```bash
cp .env.example .env

# Enable dry-run render (no paid APIs)
APP_TEST_MODE=0
APP_RENDER_DRY_RUN=1

npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Then open http://localhost:5173 and run the normal flow.

### Local PC (Real render)

```bash
cp .env.example .env
# Set OPENAI_API_KEY and ensure FFmpeg is available (system or ffmpeg-static)

npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Optional smoke script:

```bash
# Dry-run smoke (safe)
APP_RENDER_DRY_RUN=1 npm run render:smoke

# Real render smoke (requires API key + FFmpeg)
SMOKE_ALLOW_REAL=1 npm run render:smoke
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key

# Optional
ELEVENLABS_API_KEY=           # For premium TTS (not yet implemented)
MUSIC_LIBRARY_DIR=./assets/music   # For background music
ARTIFACTS_DIR=./artifacts     # Output directory
DATABASE_URL="file:./dev.db"  # SQLite database path
PORT=3001                     # Server port
APP_TEST_MODE=0               # Set to 1 to disable render + external providers
APP_RENDER_DRY_RUN=0          # Set to 1 to run render without providers/MP4
APP_DRY_RUN_FAIL_STEP=        # Inject failure at a render step (optional)
APP_DRY_RUN_STEP_DELAY_MS=0   # Optional delay before dry-run steps
APP_VERSION=                  # Optional version override for /api/health
```

## Test Mode (No Render)

Enable deterministic plan generation and block render pipelines:

```bash
# From repo root
export APP_TEST_MODE=1
npm run test
```

When APP_TEST_MODE is enabled:

- Rendering endpoints return 403
- OpenAI/FFmpeg checks are skipped for status
- Plan generation uses deterministic templates (no paid APIs)

## Render Dry-Run (No API Keys, No MP4)

Simulate the full render pipeline without OpenAI/FFmpeg:

```bash
export APP_TEST_MODE=0
export APP_RENDER_DRY_RUN=1
npm run test:render
```

Notes:

- Dry-run renders do **not** produce MP4 files.
- `/api/run/:id/download` returns 409 for dry-run runs.
- In dry-run/test mode, `/api/test/dry-run-config` can adjust fail step/delay for tests.

Optional failure injection:

```bash
export APP_DRY_RUN_FAIL_STEP=images_generate
```

Optional delay (useful for cancel/retry testing):

```bash
export APP_DRY_RUN_STEP_DELAY_MS=50
```

## E2E UI Smoke (Dry-Run)

```bash
# One-time browser install
npx playwright install --with-deps

# Runs the UI flow against a dry-run backend (no MP4)
npm run test:e2e
```

Locally, E2E reuses an existing server on port 5173 if one is running (`npm run dev`); in CI a fresh server is started.

Windows/macOS note: `npx playwright install` (without `--with-deps`) is usually sufficient. If `npm run test` or `npm run test:render` fails with **EPERM** on Windows, use `npm run test:only` / `npm run test:render:only` after at least one successful `npx prisma generate` (see TESTING_GUIDE §6).

## How to Render a 60s Facts Video

1. Open http://localhost:5173
2. Enter a topic: "5 surprising facts about the deep ocean"
3. Select "Amazing Facts" niche pack
4. Keep 60s target length
5. Click "Generate Plan"
6. Review and edit the generated content:
   - Select your preferred hook
   - Edit the outline if needed
   - Review/edit scenes
   - Adjust durations if needed
7. Click "Validate" to check for issues
8. Click "Approve & Render"
9. Watch the progress in real-time
10. Download your MP4 when complete!

## Project Structure

```
/workspace
├── apps/
│   ├── server/          # Express backend
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/
│   │   │   │   ├── plan/        # Plan generation
│   │   │   │   ├── render/      # Render pipeline
│   │   │   │   ├── providers/   # OpenAI integration
│   │   │   │   ├── ffmpeg/      # Video processing
│   │   │   │   └── captions/    # Caption generation
│   │   │   └── db/          # Prisma client
│   │   └── prisma/      # Database schema
│   └── web/             # React frontend
│       └── src/
│           ├── pages/       # App screens
│           ├── components/  # UI components
│           └── api/         # API client
├── artifacts/           # Generated video files (gitignored)
├── assets/
│   └── music/          # Optional background music
├── .env                # Environment variables
└── package.json        # Root package with workspaces
```

## API Endpoints

### Projects

- `GET /api/projects` - List all projects
- `POST /api/project` - Create new project
- `GET /api/project/:id` - Get project with plan
- `POST /api/project/:id/plan` - Generate plan
- `POST /api/project/:id/duplicate` - Duplicate project
- `DELETE /api/project/:id` - Delete project

### Plan Editing

- `PUT /api/plan/:planVersionId` - Update plan (autosave)
- `POST /api/plan/:planVersionId/validate` - Validate plan
- `POST /api/plan/:planVersionId/autofit` - Auto-fit durations
- `POST /api/plan/:planVersionId/regenerate-hooks` - Regenerate hooks
- `POST /api/plan/:planVersionId/regenerate-outline` - Regenerate outline
- `POST /api/plan/:planVersionId/regenerate-script` - Regenerate script
- `POST /api/plan/:planVersionId/approve` - Approve plan
- `POST /api/plan/:planVersionId/render` - Start render

### Scenes

- `PUT /api/scene/:sceneId` - Update scene
- `POST /api/scene/:sceneId/lock` - Toggle lock
- `POST /api/scene/:sceneId/regenerate` - Regenerate scene

### Runs

- `GET /api/run/:runId` - Get run status
- `GET /api/run/:runId/stream` - SSE progress stream
- `POST /api/run/:runId/retry` - Retry failed run
- `POST /api/run/:runId/cancel` - Cancel run
- `GET /api/run/:runId/verify` - Verify artifacts
- `GET /api/run/:runId/download` - Download MP4
- `GET /api/run/:runId/export` - Export JSON

### Health

- `GET /api/health` - Health check with mode/version/db status

## Render Pipeline Steps

1. **tts_generate** - Generate voice-over for each scene using OpenAI TTS
2. **asr_align** - Transcribe audio with Whisper for word-level timestamps
3. **images_generate** - Generate scene images with DALL-E 3
4. **captions_build** - Build ASS subtitle file with TikTok styling
5. **music_build** - Mix background music (if available)
6. **ffmpeg_render** - Create video segments with motion effects and composite final video
7. **finalize_artifacts** - Extract thumbnail and create export JSON

## Troubleshooting

### FFmpeg not found

Install FFmpeg on your system:

- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`
- Windows: Download from https://ffmpeg.org/download.html

Or the app will try to use `ffmpeg-static` automatically.

### OpenAI API errors

- Check your API key is correct in `.env`
- Ensure you have sufficient credits
- Check rate limits if generating many videos

### Video rendering fails

- Check FFmpeg is properly installed: `ffmpeg -version`
- Check logs in the run progress for specific errors
- Use "Retry" to resume from the failed step

### Database issues

```bash
# Reset database
rm apps/server/dev.db
npm run db:migrate
```

## Niche Packs

| Pack         | Description                        |
| ------------ | ---------------------------------- |
| horror       | Dark, atmospheric horror content   |
| facts        | Mind-blowing facts and information |
| motivation   | Inspirational content              |
| product      | Product reviews and showcases      |
| story        | Narrative stories                  |
| top5         | Countdown and ranking content      |
| finance_tips | Educational financial advice       |
| health_myths | Debunking health misconceptions    |
| history      | Historical events and stories      |
| gaming       | Gaming content                     |
| science      | Scientific concepts explained      |
| mystery      | Unsolved mysteries                 |

## Development & Automation

This repository uses modern automation tools for code quality and continuous integration:

- ✅ **GitHub Actions CI** - Automated testing, linting, and builds
- ✅ **Codecov** - Test coverage tracking
- ✅ **Issue Label Bot** - Automatic issue labeling
- ✅ **Husky + lint-staged** - Pre-commit code quality checks

**Want to add AI code reviews?** See **[GITHUB_MARKETPLACE_SETUP.md](GITHUB_MARKETPLACE_SETUP.md)** for:
- 🤖 Qodo Merge installation (AI code review + test generation, free for open source)
- 🔧 Alternative tools (CodeRabbit, Codacy, SonarCloud, DeepSource)
- ✅ Complete automation verification checklist
- 📚 Beginner-friendly setup instructions

## License

MIT
