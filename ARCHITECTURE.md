# Architecture

**📖 For comprehensive architecture documentation, see [docs/architecture.md](docs/architecture.md)**

This document provides a high-level overview. For detailed information including:
- System diagrams
- Component architecture
- Data flow
- Technology stack details
- Design patterns
- External dependencies

Please refer to the complete documentation in the [docs/ directory](docs/architecture.md).

---

## Quick Reference

**Tech Stack:**
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript + Prisma
- Database: SQLite (dev) / PostgreSQL (prod)
- Video: FFmpeg
- AI: OpenAI (GPT-4, DALL-E 3, TTS, Whisper)

**Workflow:**
1. Plan Generation (AI creates hooks, outline, script, scenes)
2. Studio Editing (User reviews and edits in UI)
3. Render Execution (FFmpeg + OpenAI produce MP4)

**See [docs/architecture.md](docs/architecture.md) for complete architecture documentation.**
│                         Frontend (React)                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ QuickCreate │  │ PlanStudio  │  │ RenderQueue  │ + 5 more │
│  └────────────┘  └─────────────┘  └──────────────┘          │
│         │                │                  │                 │
│         └────────────────┴──────────────────┘                 │
│                          │                                    │
│                    API Client (fetch)                         │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTP/SSE
┌──────────────────────────┼───────────────────────────────────┐
│                   Backend (Express)                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Routes (11 endpoints)                                  │ │
│  │  project, plan, scene, run, automate, batch, status... │ │
│  └────────────────┬────────────────────────────────────────┘ │
│                   │                                           │
│  ┌────────────────┴────────────────────────────────────────┐ │
│  │  Services (Business Logic)                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ Plan         │  │ Render       │  │ FFmpeg       │ │ │
│  │  │ Generator    │  │ Pipeline     │  │ Utils        │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ Captions     │  │ OpenAI       │  │ Niche Packs  │ │ │
│  │  │ Builder      │  │ Provider     │  │ (12 packs)   │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                   │                │                          │
│  ┌────────────────┴────┐  ┌────────┴────────────────────┐   │
│  │  Prisma ORM         │  │  External Services          │   │
│  │  (4 models)         │  │  - OpenAI APIs              │   │
│  │                     │  │  - FFmpeg                   │   │
│  │  SQLite/PostgreSQL  │  │  - File System (artifacts)  │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

**Evidence:** Directory structure verified in `docs/REPO_REALITY.md` lines 75-155

---

## Data Flow

### 1. Plan Generation Flow

```
User Input (Topic + Niche Pack)
    ↓
POST /api/project/:id/plan
    ↓
planGenerator.ts (GPT-4 API calls)
    ├─ Generate 5 hook options
    ├─ Generate outline
    ├─ Generate full script
    └─ Create Scene[] (narration, visuals, timing)
    ↓
Save to Database (PlanVersion + Scenes)
    ↓
Return to Frontend (Plan Studio)
```

**Evidence:** `apps/server/src/routes/project.ts` lines 180-220, `apps/server/src/services/plan/planGenerator.ts`

### 2. Render Pipeline Flow (7 Steps)

```
POST /api/plan/:id/render
    ↓
Create Run record (status: queued)
    ↓
Render Pipeline (renderPipeline.ts)
    │
    ├─ Step 1: tts_generate (OpenAI TTS for each scene)
    ├─ Step 2: asr_align (Whisper for word-level timestamps)
    ├─ Step 3: images_generate (DALL-E 3 for scene images)
    ├─ Step 4: captions_build (ASS subtitle file with styling)
    ├─ Step 5: music_build (Mix background music if available)
    ├─ Step 6: ffmpeg_render (Composite video with effects)
    └─ Step 7: finalize_artifacts (Extract thumbnail, create export JSON)
    ↓
Update Run (status: done, artifactsJson with MP4 path)
    ↓
Broadcast SSE progress events to frontend
    ↓
GET /api/run/:id/download (Stream MP4 to user)
```

**Evidence:** `apps/server/src/services/render/renderPipeline.ts` lines 50-400, `apps/server/src/routes/run.ts` lines 80-220

### 3. Real-Time Progress Flow (SSE)

```
Frontend: new EventSource('/api/run/:id/stream')
    ↓
Backend: SSE connection opened
    ↓
Render Pipeline broadcasts updates:
    { type: 'progress', step: 'images_generate', progress: 45, message: '...' }
    ↓
Frontend: Update UI with progress bar and logs
    ↓
On completion:
    { type: 'complete', finalStatus: 'done' }
    ↓
Frontend: Close EventSource, show download button
```

**Evidence:** `apps/server/src/routes/run.ts` lines 55-78, `apps/web/src/pages/RenderQueue.tsx` lines 150-200

---

## Database Schema

**File:** `apps/server/prisma/schema.prisma`

### Core Models (5)

**1. Project** - Main container
- Fields: id, title, topic, nichePackId, language, targetLengthSec, tempo, voicePreset, status, timestamps
- Relations: planVersions (1→many), runs (1→many)
- **Evidence:** Lines 9-27

**2. PlanVersion** - Immutable plan snapshots
- Fields: id, projectId, hookOptionsJson, hookSelected, outline, scriptFull, estimatesJson, validationJson, timestamps
- Relations: project (many→1), scenes (1→many), runs (1→many)
- **Evidence:** Lines 29-45

**3. Scene** - Individual video segments
- Fields: id, planVersionId, idx, narrationText, visualPrompt, effectPreset, durationTargetSec, timing, isLocked, timestamps
- Relations: planVersion (many→1)
- **Evidence:** Lines 47-63

**4. Run** - Render execution tracking
- Fields: id, projectId, planVersionId, status, progress, currentStep, logsJson, artifactsJson, resumeStateJson, analytics, timestamps
- Relations: project (many→1), planVersion (many→1)
- **Evidence:** Lines 65-92

**5. Cache** - AI provider response caching
- Fields: id, kind, hashKey, resultJson, payloadPath, createdAt
- Used for: LLM responses, images, TTS, ASR, topic suggestions
- **Evidence:** Lines 94-101

**Detailed Schema:** See `docs/data-model.md`

---

## Key Design Patterns

### 1. Immutable Plan Versions
- Each plan edit creates a new `PlanVersion` record
- Old versions preserved for audit trail and rollback
- Renders always reference specific plan version
- **Evidence:** `apps/server/src/routes/plan.ts` lines 30-50

### 2. Idempotent Render Pipeline
- Each step checks `resumeStateJson` for completion
- Failed renders can be retried from last successful step
- Prevents duplicate API calls and wasted resources
- **Evidence:** `apps/server/src/services/render/renderPipeline.ts` lines 100-150

### 3. Server-Sent Events (SSE) for Progress
- Long-running renders use SSE for real-time updates
- Avoids polling overhead
- Connection tracking for cleanup
- **Evidence:** `apps/server/src/routes/run.ts` lines 55-78

### 4. Niche Pack System
- 12 pre-configured style packs (horror, facts, motivation, etc.)
- Each defines: allowed effects, pacing rules, visual templates, caption styling
- Enables consistent brand aesthetics
- **Evidence:** `apps/server/src/services/nichePacks.ts`

### 5. Dry-Run Mode for Testing
- `APP_TEST_MODE=1` - Deterministic plans, no render
- `APP_RENDER_DRY_RUN=1` - Full pipeline without API calls/MP4
- Enables CI/CD without API costs
- **Evidence:** `apps/server/src/env.ts` lines 92-93, `apps/server/tests/renderDryRun.integration.test.ts`

### 6. API Key Authentication (Production)
- All write operations (POST/PUT/DELETE) require `Authorization: Bearer <API_KEY>`
- Read operations (GET) remain public for backward compatibility
- `API_KEY` required in production (server fails without it)
- **Evidence:** `apps/server/src/middleware/auth.ts`, `apps/server/src/env.ts` lines 49-51

---

## External Dependencies

### Required Services

**1. OpenAI API** (`services/providers/openai.ts`)
- GPT-4: Plan generation (hooks, outline, script)
- DALL-E 3: Scene image generation
- TTS: Voice-over narration
- Whisper: Caption timing alignment
- **Cost Analysis:** `docs/cost/COST_ANALYSIS_60SEC_VIDEO.md`

**2. FFmpeg** (`services/ffmpeg/ffmpegUtils.ts`)
- Video composition with motion effects
- Audio mixing (voiceover + background music)
- Caption overlaying (ASS subtitles)
- Thumbnail extraction
- Scene concatenation

### Optional Services

**3. ElevenLabs API** (configured but not yet implemented)
- Planned for premium text-to-speech
- Environment variable exists but no code usage
- **Evidence:** `apps/server/src/env.ts` line 89

### Storage

**4. File System**
- Artifacts: `./artifacts` (rendered MP4s, thumbnails, exports)
- Music: `./assets/music` (optional background tracks)
- Database: SQLite file or PostgreSQL connection
- **Evidence:** `apps/server/src/env.ts` lines 90-91

---

## Deployment Architecture

### Docker (Recommended for Production)
```
┌─────────────────────────────────────────┐
│  Docker Container                        │
│  ┌───────────────────────────────────┐  │
│  │  Node.js 20 (Alpine)               │  │
│  │  ├─ Express Server (Port 3001)    │  │
│  │  ├─ FFmpeg (installed via apk)    │  │
│  │  └─ Prisma Client (generated)     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────┐  ┌─────────────────┐│
│  │ Volume: data  │  │ Volume:         ││
│  │ (SQLite DB)   │  │ artifacts       ││
│  └───────────────┘  └─────────────────┘│
└─────────────────────────────────────────┘
         │
         ├─ OpenAI API (external)
         └─ Reverse Proxy (nginx/Caddy) → HTTPS
```

**Evidence:** `Dockerfile`, `docker-compose.yml`, `docs/deployment.md`

### Monorepo Structure
```
/
├── apps/
│   ├── server/  (Backend workspace)
│   └── web/     (Frontend workspace)
├── package.json (Root workspace manager)
└── node_modules (Shared dependencies)
```

**Evidence:** Root `package.json` lines 7-10, `docs/REPO_REALITY.md` lines 75-155

---

## Architecture Decision Records (ADRs)

Significant architectural decisions are documented in `docs/adr/`:

1. **0001-record-architecture-decisions.md** - Using ADRs for documentation
2. **0002-monorepo-structure.md** - npm workspaces for monorepo
3. **0003-render-pipeline-design.md** - 7-step idempotent pipeline

**Evidence:** `docs/adr/` directory

---

## Performance Considerations

### 1. Concurrent Image Generation
- Default: 3 concurrent DALL-E 3 requests
- Configurable via `MAX_CONCURRENT_IMAGE_GENERATION` env var
- Uses `p-limit` library for concurrency control
- **Evidence:** `apps/server/src/services/render/renderPipeline.ts` lines 25-35

### 2. Database Connection Pooling
- SQLite: better-sqlite3 (synchronous, no pooling)
- PostgreSQL: Configurable connection limit and timeout
- Defaults: 10 connections, 10s timeout
- **Evidence:** `apps/server/src/env.ts` lines 86-87

### 3. FFmpeg Timeouts
- 5-minute timeout for render operations
- 30-second timeout for probe operations
- Prevents hung processes
- **Evidence:** `apps/server/src/services/ffmpeg/ffmpegUtils.ts` lines 50-60

### 4. Rate Limiting
- Production: 100 requests per 15 minutes per IP
- Development: 1000 requests per 15 minutes
- Protects against DoS and abuse
- **Evidence:** `apps/server/src/index.ts` lines 40-60

---

## Security Architecture

### 1. API Authentication
- `API_KEY` required in production for write operations
- Bearer token authentication via middleware
- Read-only endpoints remain public
- **Evidence:** `apps/server/src/middleware/auth.ts`

### 2. Input Validation
- All API inputs validated with Zod schemas
- UUID validation for path parameters
- Strict schemas reject unknown fields
- **Evidence:** All route files use Zod `safeParse()`

### 3. CORS Protection
- `ALLOWED_ORIGINS` whitelist in production
- Credentials disabled (no cookie-based auth)
- Prevents CSRF attacks
- **Evidence:** `apps/server/src/index.ts` lines 70-85

### 4. Security Headers
- Helmet.js enabled in production
- Content Security Policy (CSP)
- XSS protection, frame denial, etc.
- **Evidence:** `apps/server/src/index.ts` lines 65-68

### 5. Path Traversal Prevention
- Artifact paths validated before serving
- Logs suspicious attempts
- **Evidence:** `apps/server/src/routes/run.ts` lines 200-220

**Detailed Security:** See `SECURITY.md`, `docs/security.md`

---

## Testing Architecture

### Test Modes

**1. Unit Tests** (`tests/*.unit.test.ts`)
- Isolated function testing
- No external dependencies
- Fast execution (<100ms per test)
- **Evidence:** `apps/server/tests/planValidator.unit.test.ts`

**2. Integration Tests** (`tests/*.integration.test.ts`)
- Full API endpoint testing with supertest
- Real database (SQLite in-memory)
- APP_TEST_MODE=1 (no external APIs)
- **Evidence:** `apps/server/tests/api.integration.test.ts`

**3. Render Dry-Run Tests** (`tests/renderDryRun.integration.test.ts`)
- Complete render pipeline without API calls
- Validates all 7 steps execute
- Tests cancellation and retry logic
- **Evidence:** `apps/server/tests/renderDryRun.integration.test.ts`

**4. E2E Tests** (Playwright)
- Full user workflows in browser
- Runs against dry-run backend
- Tests UI interactions and SSE updates
- **Evidence:** `playwright.config.mjs`, `apps/web/tests/e2e/`

**Test Guide:** See [docs/testing.md](docs/testing.md)

---

## Scaling Considerations

### Horizontal Scaling (Multiple Instances)
- **Stateless Backend:** No in-memory session state
- **Shared Database:** PostgreSQL with connection pooling
- **Shared Artifacts:** NFS mount or S3-compatible storage
- **Load Balancer:** Distribute requests across instances
- **SSE Sticky Sessions:** Required for event streams

### Vertical Scaling (Single Instance)
- **Database:** Increase connection limit and pool timeout
- **Image Generation:** Increase MAX_CONCURRENT_IMAGE_GENERATION
- **Memory:** 2GB minimum, 4GB+ recommended for concurrent renders
- **CPU:** 4+ cores for parallel FFmpeg rendering

### Cost Optimization
- **Caching:** Topic suggestions cached (5-minute TTL)
- **Image Reuse:** Scene images stored in artifacts
- **Local TTS:** Consider replacing OpenAI TTS with local Coqui/Piper
- **Render Queuing:** Limit concurrent renders to control API costs

**Detailed Scaling:** See `docs/operations-runbook.md` Scaling section, `docs/cost/` directory

---

## Development Principles

1. **Evidence-Based Documentation:** Every architectural claim backed by file path citation
2. **Type Safety:** TypeScript strict mode, Zod validation, no `any` types
3. **Error Handling:** Comprehensive try-catch, never bare JSON.parse()
4. **Structured Logging:** Winston for all logging, silent in tests
5. **Idempotency:** Retry-safe operations, resumable pipelines
6. **Security First:** API key auth, input validation, rate limiting, CSP

**Developer Guide:** See `docs/development.md`, `CONTRIBUTING.md`, `AGENTS.md`

---

## Additional Resources

- **Comprehensive Architecture:** [docs/architecture.md](docs/architecture.md)
- **API Reference:** [docs/api.md](docs/api.md)
- **Data Model:** [docs/data-model.md](docs/data-model.md)
- **Repository Reality Check:** [docs/REPO_REALITY.md](docs/REPO_REALITY.md)
- **Operations Runbook:** [RUNBOOK.md](RUNBOOK.md), [docs/operations-runbook.md](docs/operations-runbook.md)
- **Deployment Guides:** [docs/deployment.md](docs/deployment.md)
- **Security:** [SECURITY.md](SECURITY.md), [docs/security.md](docs/security.md)

---

**Last Updated:** 2026-02-06  
**Evidence-Based:** All paths and claims verified in codebase
