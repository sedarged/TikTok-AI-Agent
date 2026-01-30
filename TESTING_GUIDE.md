# Complete Testing Guide - TikTok AI Agent

## Quick Start

### Option 1: Automated Setup (Recommended)

**Windows:**

```bash
.\setup-testing.bat
```

**macOS/Linux:**

```bash
chmod +x setup-testing.sh
./setup-testing.sh
```

This will:

1. ✅ Install all dependencies
2. ✅ Generate Prisma client
3. ✅ Create SQLite database with schema
4. ✅ Seed test data (projects, niche packs)
5. ✅ Run all backend tests
6. ✅ Start concurrent dev server (backend + frontend)

### Option 2: Manual Setup

If you prefer to run commands individually:

```bash
npm install                  # Install dependencies
npm run db:generate         # Generate Prisma client
npm run db:migrate:dev      # Create/reset database
npm run db:seed             # Populate test data
npm run test                # Run all tests
npm run dev                 # Start dev environment
```

---

## Environment Setup

Both `.env.local` files have been created automatically:

- **apps/server/.env.local** - Dry-run mode (no paid API calls)
- **apps/web/.env.local** - Frontend API URL configuration

### Key Settings

```env
# Backend: Dry-run mode (no OpenAI API costs)
APP_RENDER_DRY_RUN=1        # Full pipeline without paid APIs
APP_TEST_MODE=1             # Mock OpenAI responses

# Frontend: API endpoint
VITE_API_URL=http://localhost:3001/api
```

---

## Access Points

Once running, visit:

| Component     | URL                       | Purpose                             |
| ------------- | ------------------------- | ----------------------------------- |
| **Web UI**    | http://localhost:5173     | React frontend                      |
| **API**       | http://localhost:3001/api | Express backend                     |
| **Database**  | apps/server/app.db        | SQLite (test data)                  |
| **Artifacts** | apps/server/artifacts/    | Generated videos (empty in dry-run) |

---

## Testing Workflow

### 1. Lint, typecheck, and quality

Run these before committing (CI runs them too):

```bash
npm run lint          # ESLint (no fix)
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check only
npm run typecheck     # TypeScript (server + web, no emit)
npm run check         # lint + typecheck
npm run audit         # npm audit (dependency vulnerabilities); CI runs this too
```

Pre-commit (Husky + lint-staged) runs `eslint --fix` and `prettier --write` on staged files. Run `npm run audit` periodically (e.g. before release); CI runs it in the lint-typecheck-build job. See [DEVELOPMENT_MASTER_PLAN.md](DEVELOPMENT_MASTER_PLAN.md) and [AGENTS.md](AGENTS.md). **AI agents:** run `npm run test` before pushing; see [AGENTS.md](AGENTS.md) for full workflow.

### 2. Backend Tests (No Frontend)

```bash
# Run all unit + integration tests
npm run test

# Run only render pipeline tests (dry-run mode)
npm run test:render

# Run with specific test file
npm run test -- src/services/plan/planGenerator.test.ts
```

### 3. Frontend Manual Testing

Open http://localhost:5173 and test:

#### Create Project

- Click "Create Project" (or "Quick Create")
- Fill form:
  - **Topic**: "Scary ghost stories" (example)
  - **Niche Pack**: Select "Horror"
  - **Target Length**: 60 seconds
  - **Tempo**: "normal"
- Click "Generate Plan"
- Wait for AI to generate hook options, outline, script, scenes

#### View/Edit Plan

- Projects page shows your new project
- Click to open "Plan Studio"
- Review:
  - ✅ Hook options (choose one)
  - ✅ Outline structure
  - ✅ Full script
  - ✅ Individual scenes with narration + visual prompts
  - ✅ Effect presets (matches niche pack)
- Edit any scene narration/visuals
- Click "Approve Plan"

#### Start Render

- Click "Render" button
- Navigates to "Render Queue"
- Watch real-time progress:
  - Step 1: `tts_generate` (15%)
  - Step 2: `asr_align` (25%)
  - Step 3: `images_generate` (40%)
  - Step 4: `captions_build` (60%)
  - Step 5: `music_build` (75%)
  - Step 6: `ffmpeg_render` (90%)
  - Step 7: `finalize_artifacts` (100%)
- See logs accumulate in sidebar
- **Note**: In dry-run mode, video is empty (no cost)

#### View Output

- After render completes, click "View Output"
- See artifact paths:
  - MP4 video file (empty in dry-run)
  - Thumbnail JPG
  - ASS captions file
  - Audio MP3

### 4. Test Error Handling

Simulate specific failures to test error handling:

```bash
# Simulate FFmpeg failure mid-pipeline
APP_RENDER_DRY_RUN=1 APP_DRY_RUN_FAIL_STEP=ffmpeg_render npm run dev
```

Then:

1. Create a project and start render
2. It will fail at `ffmpeg_render` step
3. Verify error message displays in UI
4. Check `Run.status` in database = `"failed"`

**Available steps to fail:**

- `tts_generate`
- `asr_align`
- `images_generate`
- `captions_build`
- `music_build`
- `ffmpeg_render`
- `finalize_artifacts`

### 5. E2E (Playwright)

Before running E2E tests for the first time (or after updating Playwright), install browsers:

```bash
npx playwright install
```

Then run E2E tests (starts dev server and runs tests):

```bash
npm run test:e2e
```

**E2E locally:** When not in CI, Playwright uses `reuseExistingServer: true` – if `http://localhost:5173` is already running (e.g. `npm run dev`), E2E will use it instead of starting a new server. In CI, a fresh server is always started.

**E2E stability:** Prefer `expect` on stable states and polling (e.g. waiting for a run status with a short interval) instead of long fixed `sleep`s. This keeps E2E reliable and avoids flakiness when the app is slower or faster than expected.

### 6. Windows: EPERM on `prisma generate`

On Windows, `npm run test` or `npm run test:render` can fail with **EPERM** when Prisma tries to rename `query_engine-windows.dll.node` (antivirus, another process, or Node 24). Workarounds:

1. Run **`npm run test:only`** (and **`npm run test:render:only`**) – they skip `prisma generate` and only run migrate + vitest. Use after at least one successful `npx prisma generate` in `apps/server` (e.g. from another terminal or after a clean boot).
2. Close other processes using the repo (IDE, other terminals), or run terminal as Administrator.
3. Prefer **Node 20 LTS**; Node 24 can trigger spawn EPERM (see README / PRZEWODNIK_TESTY_WINDOWS.md).

---

## Database Inspection

View test data created by seeding:

```bash
# Open SQLite CLI
sqlite3 apps/server/app.db

# Useful queries:
SELECT COUNT(*) FROM "Project";                    # See projects created
SELECT * FROM "Project" LIMIT 3;                   # View first 3 projects
SELECT * FROM "PlanVersion" WHERE "projectId" = '<project-id>';
SELECT * FROM "Scene" LIMIT 5;                     # View scenes
SELECT * FROM "Run" ORDER BY "createdAt" DESC LIMIT 5;  # View render runs

# Export logs from a run:
SELECT "currentStep", "progress", "logsJson" FROM "Run" WHERE id = '<run-id>';

# Exit CLI:
.exit
```

---

## File Structure After Setup
