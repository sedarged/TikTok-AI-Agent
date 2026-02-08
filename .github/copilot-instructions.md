# AI Agent Instructions for TikTok-AI-Agent

**Project:** Full-stack TikTok-style AI video generator (React + Node/Express + TypeScript)  
**Updated:** February 1, 2026

**📍 Read First:**
- [STATUS.md](../STATUS.md) - Current priorities and active work
- [.cursor/QUICKREF.md](../.cursor/QUICKREF.md) - 30-second quick reference
- [.cursor/docs/](../.cursor/docs/) - AI-focused guides (layout, pitfalls, decision trees)
- [AGENTS.md](../AGENTS.md) - Full agent instructions

---

## Architecture Overview

### Data Flow: Topic → Plan → Render → MP4

1. **Plan Phase** - AI generates hooks, outline, script, and scene structure
2. **Studio Phase** - User edits/approves plan in the UI
3. **Render Phase** - FFmpeg + OpenAI (TTS, images, captions) produces final MP4

### Core Models (Prisma)

- **Project** - Container with niche pack (horror, facts, gaming, etc.), tempo, voice preset, SEO keywords
- **PlanVersion** - Immutable plan snapshot with hook options, outline, script, scenes, script template ID
- **Scene** - Individual video segment with narration, visual prompt, timing, effect preset, lock state
- **Run** - Render execution with step tracking (7 steps: tts_generate → asr_align → images_generate → captions_build → music_build → ffmpeg_render → finalize_artifacts)
  - **Analytics fields**: `views`, `likes`, `retention` - Post-publish performance metrics
  - **Scheduling fields**: `scheduledPublishAt`, `publishedAt` - Content calendar integration

See [apps/server/prisma/schema.prisma](../apps/server/prisma/schema.prisma) for full schema.

### Service Layers

- **Plan Generation** - Calls OpenAI GPT-4 with niche pack context
- **Render Pipeline** - Orchestrates 7-step render with SSE progress broadcast
- **FFmpeg Utils** - Video composition, concatenation, audio mixing, thumbnail extraction
- **Captions Builder** - Alignment via Whisper ASR transcription

See [.cursor/docs/project-layout.md](../.cursor/docs/project-layout.md) for detailed structure.

---

## Development Workflow

### Commands

```bash
npm install          # Install deps (both apps)
npm run dev          # Server (3001) + web (5173)
npm run build        # Build both apps
npm run test         # Backend tests
npm run test:render  # Render tests (dry-run)
npm run test:e2e     # Playwright E2E
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run check        # lint + typecheck
```

Before committing: run `npm run check`. Pre-commit runs lint-staged on staged files.

### Test Modes

- `APP_TEST_MODE=1` - Mock OpenAI responses, no API calls (fast)
- `APP_RENDER_DRY_RUN=1` - Full render pipeline without paid APIs
- `APP_DRY_RUN_FAIL_STEP=<step>` - Simulate failure at specific step

**See [.cursor/docs/test-modes.md](../.cursor/docs/test-modes.md) for comprehensive test mode guide.**

---

## Code Patterns & Conventions

### Critical Rules

1. **Never use bare `JSON.parse()`** - Always wrap in try-catch
2. **All API inputs must be validated** - Use Zod `safeParse()`, return 400 on failure
3. **UUID path params** - Validate with `z.string().uuid()`
4. **Use Prisma singleton** - Import from `db/client`, not `@prisma/client`
5. **No TODOs/placeholders** - Implement or remove before committing

See [.cursor/docs/common-pitfalls.md](../.cursor/docs/common-pitfalls.md) for detailed examples.

### Input Validation (Zod)

```typescript
const schema = z.object({
  topic: z.string().min(1).max(500),
  nichePackId: z.string().min(1),
}).strict();

const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ 
    error: 'Invalid request', 
    details: parsed.error.flatten() 
  });
}
```

### Error Handling

```typescript
// JSON parsing
let parsed = {};
try {
  parsed = JSON.parse(jsonString);
} catch (error) {
  console.error('Failed to parse JSON:', error);
  parsed = {}; // sensible default
}

// API calls
try {
  const data = await apiClient.createProject(topic, nichePackId);
  setProject(data);
} catch (error) {
  setError(getErrorMessage(error)); // Show to user
}
```

### Database Queries

```typescript
import { prisma } from 'db/client'; // Use singleton

const project = await prisma.project.findUnique({ 
  where: { id },
  include: { planVersions: { include: { scenes: true } } } // Always include relations
});
```

---

## Server-Sent Events (SSE) Architecture

Real-time render progress streamed via `/api/run/:runId/stream`:

**Server:** Set SSE headers, track connections, broadcast updates after each render step  
**Client:** `new EventSource()`, handle `onmessage` events, update UI  
**Messages:** `{ type: 'progress', step, progress, message }` or `{ type: 'complete', finalStatus }`

See [apps/server/src/routes/run.ts](../apps/server/src/routes/run.ts) and [apps/web/src/pages/RenderQueue.tsx](../apps/web/src/pages/RenderQueue.tsx).

---

## Caption Alignment via Whisper (ASR)

1. **TTS Generate** - Create voiceover MP3
2. **ASR Align** - Whisper transcribes with word-level timestamps (`response_format: 'verbose_json'`, `timestamp_granularities: ['word']`)
3. **Build Captions** - Convert to ASS format with word-by-word highlighting

**Fallback:** If Whisper fails, use scene timing estimates.

See [apps/server/src/services/captions/captionsBuilder.ts](../apps/server/src/services/captions/captionsBuilder.ts).

---

## Niche Pack System

12 packs (horror, facts, motivation, etc.) define:
- **Effect presets** - Allowed visual effects and default (e.g., `slow_zoom_in`, `glitch`)
- **Pacing rules** - Scene count and duration by target video length
- **Style templates** - Visual generation prompts, negative prompts, hook rules, caption styling

See [apps/server/src/services/nichePacks.ts](../apps/server/src/services/nichePacks.ts) and [apps/server/src/utils/types.ts](../apps/server/src/utils/types.ts).

---

## Production Considerations

### Security Checklist

- ✅ CORS: Use `ALLOWED_ORIGINS` env var (comma-separated URLs)
- ✅ Input validation: All routes use Zod with `.strict()`
- ✅ Path traversal: Validate artifact paths before serving
- ✅ Rate limiting: Add `express-rate-limit` before public deployment
- ❌ No hardcoded secrets (use `.env`)

See [SECURITY.md](../SECURITY.md) for full recommendations.

### Environment Variables

```bash
OPENAI_API_KEY=sk-...           # Required for plan generation, TTS, images
DATABASE_URL=file:./app.db      # SQLite (use PostgreSQL in production)
ARTIFACTS_DIR=./artifacts       # Where rendered videos are stored
NODE_ENV=production             # Activates security validations
ALLOWED_ORIGINS=https://yourdomain.com  # CORS whitelist
```

See `.env.example` for complete list.

### Render Pipeline Reliability

- **Idempotent steps** - Pipeline saves state after each step; can resume from failures
- **Timeout protection** - FFmpeg (5 min), probe (30 sec), version check (10 sec)
- **Artifact verification** - Validates all outputs before marking complete
- **Cancellation** - Active runs tracked in Map; `cancelRun()` sets flag, pipeline checks before each step

See [apps/server/src/services/render/renderPipeline.ts](../apps/server/src/services/render/renderPipeline.ts).

---

## Key Files by Purpose

| Purpose | Files |
| --- | --- |
| REST API routes | [apps/server/src/routes/](../apps/server/src/routes/) |
| One-click automation | [apps/server/src/routes/automate.ts](../apps/server/src/routes/automate.ts) |
| Batch video creation | [apps/server/src/routes/batch.ts](../apps/server/src/routes/batch.ts) |
| Plan generation | [apps/server/src/services/plan/planGenerator.ts](../apps/server/src/services/plan/planGenerator.ts) |
| Render pipeline | [apps/server/src/services/render/renderPipeline.ts](../apps/server/src/services/render/renderPipeline.ts) |
| FFmpeg utils | [apps/server/src/services/ffmpeg/ffmpegUtils.ts](../apps/server/src/services/ffmpeg/ffmpegUtils.ts) |
| React pages | [apps/web/src/pages/](../apps/web/src/pages/) |
| Quick create UI | [apps/web/src/pages/QuickCreate.tsx](../apps/web/src/pages/QuickCreate.tsx) |
| Batch create UI | [apps/web/src/pages/BatchCreate.tsx](../apps/web/src/pages/BatchCreate.tsx) |
| Analytics dashboard | [apps/web/src/pages/Analytics.tsx](../apps/web/src/pages/Analytics.tsx) |
| Content calendar | [apps/web/src/pages/Calendar.tsx](../apps/web/src/pages/Calendar.tsx) |
| API client | [apps/web/src/api/client.ts](../apps/web/src/api/client.ts) |
| Database schema | [apps/server/prisma/schema.prisma](../apps/server/prisma/schema.prisma) |
| Test setup | [apps/server/tests/setup.ts](../apps/server/tests/setup.ts) |

---

## Common Development Tasks

See [.cursor/docs/decision-trees.md](../.cursor/docs/decision-trees.md) for detailed flowcharts on:
- Adding new API endpoints
- Modifying database schema
- Debugging validation errors
- Debugging render pipeline failures
- Creating new React pages
- Adding npm packages
- Debugging failing tests
- Updating documentation

---

## More Information

- **Full agent instructions:** [AGENTS.md](../AGENTS.md)
- **Current priorities:** [STATUS.md](../STATUS.md)
- **Quick reference:** [.cursor/QUICKREF.md](../.cursor/QUICKREF.md)
- **AI docs:** [.cursor/docs/](../.cursor/docs/)
- **User docs:** [docs/README.md](../docs/README.md)
- **Security:** [SECURITY.md](../SECURITY.md)
