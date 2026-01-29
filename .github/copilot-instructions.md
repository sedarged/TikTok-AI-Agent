# AI Agent Instructions for TikTok-AI-Agent

**Project:** Full-stack TikTok-style AI video generator (React + Node/Express + TypeScript)  
**Updated:** January 29, 2026

## Architecture Overview

### Data Flow: Topic → Plan → Render → MP4
The entire application revolves around this 3-step workflow:

1. **Plan Phase** - AI generates hooks, outline, script, and scene structure
2. **Studio Phase** - User edits/approves plan in the UI
3. **Render Phase** - FFmpeg + OpenAI (TTS, images, captions) produces final MP4

### Core Models (Prisma)
- **Project** - Container with niche pack (horror, facts, gaming, etc.), tempo, voice preset
- **PlanVersion** - Immutable plan snapshot with hook options, outline, script, scenes
- **Scene** - Individual video segment with narration, visual prompt, timing, effect preset
- **Run** - Render execution with step tracking (tts_generate → asr_align → images_generate → captions_build → music_build → ffmpeg_render → finalize_artifacts)

See [apps/server/prisma/schema.prisma](apps/server/prisma/schema.prisma) for schema.

### Service Layers
- **Plan Generation** ([apps/server/src/services/plan/](apps/server/src/services/plan/)) - Calls OpenAI GPT-4 with niche pack context (effect presets, pacing, style templates)
- **Render Pipeline** ([apps/server/src/services/render/renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts)) - Orchestrates 7-step render with SSE progress broadcast
- **FFmpeg Utils** ([apps/server/src/services/ffmpeg/ffmpegUtils.ts](apps/server/src/services/ffmpeg/ffmpegUtils.ts)) - Video composition, concatenation, audio mixing, thumbnail extraction
- **Captions Builder** ([apps/server/src/services/captions/captionsBuilder.ts](apps/server/src/services/captions/captionsBuilder.ts)) - Alignment via Whisper ASR transcription

## Development Workflow

### Commands
```bash
npm install                  # Install both apps/server and apps/web
npm run dev                 # Concurrent: server (port 3001) + web (port 5173)
npm run build               # Build both apps for production
npm run test                # Vitest backend tests (unit + integration)
npm run test:render         # Render pipeline tests (dry-run mode, no paid APIs)
npm run test:e2e            # Playwright end-to-end tests
npm run db:generate         # Prisma generate (auto-run on postinstall)
npm run db:migrate:dev      # Create migration after schema change
npm run db:seed             # Populate test data
```

### Test Modes
- **APP_TEST_MODE=1** - Mock OpenAI responses, no API calls (fast)
- **APP_RENDER_DRY_RUN=1** - Full render pipeline without paid APIs; outputs are empty files (validates orchestration)
- **APP_RENDER_DRY_RUN=1 APP_DRY_RUN_FAIL_STEP=ffmpeg_render** - Simulate failure at specific step (tests error handling)

## Code Patterns & Conventions

### Error Handling
**Never use bare `JSON.parse()`** - Always wrap in try-catch:
```typescript
let parsed = {};
try {
  parsed = JSON.parse(jsonString);
} catch (error) {
  console.error('Failed to parse JSON:', error);
  parsed = {}; // or other sensible default
}
```
See [apps/server/src/routes/run.ts](apps/server/src/routes/run.ts#L70) for example.

### Input Validation (Zod)
All API routes validate requests with Zod schemas in [apps/server/src/utils/apiSchemas.ts](apps/server/src/utils/apiSchemas.ts). Always:
- Use `schema.safeParse()` (not `parse()`) to avoid throwing
- Return 400 with error details if validation fails
- Add constraints (string length, enum values, number ranges)

**Example from project creation** ([apps/server/src/routes/project.ts](apps/server/src/routes/project.ts#L10-L18)):
```typescript
const createProjectSchema = z.object({
  topic: z.string().min(1).max(500),                    // Required, 1-500 chars
  nichePackId: z.string().min(1),                       // Required
  language: z.string().min(1).max(10).optional(),       // Optional, 1-10 chars
  targetLengthSec: z.number().int().positive().max(600).optional(),  // 1-600 seconds
  tempo: z.enum(['slow', 'normal', 'fast']).optional(), // Enum constraint
  voicePreset: z.string().min(1).max(50).optional(),
  visualStylePreset: z.string().nullable().optional(),
}).strict(); // Reject unknown fields
```

**Usage pattern**:
```typescript
const parsed = createProjectSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    error: 'Invalid project payload',
    details: parsed.error.flatten(),  // Returns nested error structure
  });
}
const { topic, nichePackId, ... } = parsed.data;
```

**Common constraints**:
- `.min(n).max(m)` - String length or numeric range
- `.int().positive()` - Integer, greater than 0
- `.enum(['a', 'b'])` - One of allowed values
- `.optional()` - Field is optional
- `.nullable()` - Field can be null
- `.strict()` - Reject extra fields (security)

### Database Queries
- Prisma queries use [apps/server/src/db/client.ts](apps/server/src/db/client.ts) singleton
- Always include necessary relations (e.g., `include: { scenes: {...} }`)
- Use `onDelete: Cascade` for orphaned records

### Server-Sent Events (SSE) Architecture
Real-time render progress streamed to connected React clients via [apps/server/src/routes/run.ts](apps/server/src/routes/run.ts#L40-L100). See `RenderQueue.tsx` for frontend usage.

**Server side** ([apps/server/src/routes/run.ts](apps/server/src/routes/run.ts#L40-L100)):
```typescript
// GET /api/run/:runId/stream - Establishes long-lived connection
runRoutes.get('/:runId/stream', async (req, res) => {
  const runId = req.params.runId;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Track all connections per runId in Map<runId, Set<res>>
  if (!sseConnections.has(runId)) {
    sseConnections.set(runId, new Set());
  }
  sseConnections.get(runId)!.add(res);
  
  // Send initial run state
  const run = await prisma.run.findUnique({ where: { id: runId } });
  res.write(`data: ${JSON.stringify({
    type: 'state',
    status: run.status,
    progress: run.progress,
    currentStep: run.currentStep,
    logs: JSON.parse(run.logsJson),
  })}\n\n`);
  
  // Cleanup on client disconnect
  req.on('close', () => {
    sseConnections.get(runId)?.delete(res);
  });
});

// Broadcast function called by render pipeline after each step
export function broadcastRunUpdate(runId: string, data: any) {
  const connections = sseConnections.get(runId);
  if (connections) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of connections) {
      try {
        res.write(message);
      } catch (e) {
        connections.delete(res);  // Connection already closed
      }
    }
  }
}
```

**Message format** - Newline-delimited JSON:
```
data: {"type":"progress","step":"tts_generate","progress":15,"message":"Generating voice-over..."}

data: {"type":"progress","step":"asr_align","progress":25,"message":"Transcribing audio..."}

data: {"type":"complete","finalStatus":"done","progress":100,"artifacts":{"mp4Path":"...","thumbPath":"..."}}
```

**Frontend connection** ([apps/web/src/pages/RenderQueue.tsx](apps/web/src/pages/RenderQueue.tsx)):
```typescript
const eventSource = new EventSource(`/api/run/${runId}/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'state') {
    // Initial state load
    setRun(data);
  } else if (data.type === 'progress') {
    // Update progress bar, logs
    setProgress(data.progress);
    addLog(data.message);
  } else if (data.type === 'complete') {
    // Render finished
    setRun({ ...run, status: data.finalStatus });
    eventSource.close();
  }
};

eventSource.onerror = () => {
  eventSource.close();
};

// Cleanup on unmount
return () => eventSource.close();
```

**Pipeline broadcasts** ([apps/server/src/services/render/renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts#L200-L250)):
- After each step completion: `broadcastRunUpdate(runId, { type: 'progress', step, progress })`
- On errors: `broadcastRunUpdate(runId, { type: 'error', message })`
- On completion: `broadcastRunUpdate(runId, { type: 'complete', finalStatus: 'done' })`

### SSE Broadcasting for Progress
Render updates broadcast to connected clients via [apps/server/src/routes/run.ts](apps/server/src/routes/run.ts#L190-L200) with `broadcastRunUpdate()`:
```typescript
// Emitted after each pipeline step
res.write(`data: ${JSON.stringify({ type: 'progress', step, progress })}\n\n`);
```

### Caption Alignment via Whisper (ASR)
The render pipeline produces word-level timing for synchronized captions via OpenAI's Whisper API. See [apps/server/src/services/captions/captionsBuilder.ts](apps/server/src/services/captions/captionsBuilder.ts) and [apps/server/src/services/providers/openai.ts](apps/server/src/services/providers/openai.ts#L154).

**Flow**:
1. **TTS Generate** - Create voiceover MP3 from narration text
2. **ASR Align** - Whisper transcribes MP3 with `response_format: 'verbose_json'` and `timestamp_granularities: ['word']`
3. **Build Captions** - Word timings converted to ASS subtitle format with highlights

**Whisper Output** ([apps/server/src/services/providers/openai.ts](apps/server/src/services/providers/openai.ts#L154-L183)):
```typescript
const transcription = await client.audio.transcriptions.create({
  file: fs.createReadStream(audioPath),
  model: 'whisper-1',
  response_format: 'verbose_json',          // Returns detailed timing
  timestamp_granularities: ['word'],        // Word-level timestamps
});

// Result structure:
// { 
//   text: "full transcription...",
//   words: [
//     { word: "hello", start: 0.0, end: 0.5 },
//     { word: "world", start: 0.6, end: 1.2 }
//   ]
// }
```

**ASS Caption Format** - Generates [V4+ Styles](https://en.wikibooks.org/wiki/Guide_to_Advanced_Subtitles/ASS_file_format) with:
- **Primary color** - Main caption text (e.g., white)
- **Highlight color** - Current word being spoken (e.g., gold)
- **Outline** - Black stroke for readability
- **Position** - Bottom safe zone (TikTok standard) with margin

Example event line:
```
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Hello {\\c&HFFD700&}world{\\c}
```
(First 0.5s white "Hello", then gold "world" 0.5-1.0s)

**Grouping words into segments** ([apps/server/src/services/captions/captionsBuilder.ts](apps/server/src/services/captions/captionsBuilder.ts#L138-L165)):
```typescript
// Group words by pauses (>0.5s) or max 6 words per segment
for (let i = 0; i < words.length; i++) {
  currentSegment.push(words[i]);
  
  const isLongPause = words[i + 1].start - words[i].end > 0.5;
  const isTooLong = currentSegment.length >= 6;
  const isEnd = i === words.length - 1;
  
  if (isLongPause || isTooLong || isEnd) {
    segments.push({
      text: currentSegment.map(w => w.word).join(' '),
      start: currentSegment[0].start,
      end: currentSegment[currentSegment.length - 1].end,
      words: currentSegment,  // For word-by-word highlighting
    });
  }
}
```

**Fallback mode** - If Whisper fails, use scene timing as fallback:
```typescript
// Uses scene.startTimeSec and scene.endTimeSec instead of word timings
buildCaptionsFromScenes(scenes, captionStyle, outputPath);
```

### Niche Pack System
[apps/server/src/services/nichePacks.ts](apps/server/src/services/nichePacks.ts) defines 12 packs (horror, facts, motivation, product, story, top5, finance, health, history, gaming, science, mystery). Each pack contains:

#### Effect Presets ([apps/server/src/utils/types.ts](apps/server/src/utils/types.ts#L1-L12))
Each pack specifies allowed effects (from `slow_zoom_in`, `slow_zoom_out`, `pan_left`, `pan_right`, `tilt_up`, `tilt_down`, `flash_cut`, `fade`, `glitch`, `static`) and a default. Example:
```typescript
effectsProfile: {
  allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'fade', 'glitch', 'flash_cut'],
  defaultEffect: 'slow_zoom_in',
}
```

#### Pacing Rules
Dynamic scene counts and durations based on target video length (60s, 90s, 120s, 180s):
```typescript
scenePacing: {
  60: { minScenes: 6, maxScenes: 8, minDurationSec: 5, maxDurationSec: 12 },
  90: { minScenes: 8, maxScenes: 10, minDurationSec: 6, maxDurationSec: 14 },
  // ... more lengths
}
```

#### Template Styles
- **styleBiblePrompt** - OpenAI instruction for visual generation (e.g., "Dark, eerie, cinematic horror style...")
- **globalNegativePrompt** - Words to exclude from DALL-E 3 (e.g., "blurry, low quality, watermark...")
- **hookRules** - Array of rules for hook generation (e.g., "Start with chilling statement...")
- **captionStyle** - Font, colors, outline, positioning for ASS subtitle format

#### Caption Styling Example
```typescript
captionStyle: {
  fontFamily: 'Arial Black',
  fontSize: 48,
  primaryColor: '#FFFFFF',      // Main caption color
  outlineColor: '#000000',      // Outline for readability
  outlineWidth: 4,
  highlightColor: '#FFD700',    // Word-by-word highlight color
  marginBottom: 200,            // Distance from bottom (for TikTok safe zone)
  marginHorizontal: 40,
}
```

## Critical Production Considerations

### Security Checklist
- **CORS**: Configure `ALLOWED_ORIGINS` env var (comma-separated URLs); defaults block production requests
- **Artifacts**: Currently served as static files; add authentication or signed URLs for production
- **Rate Limiting**: Not implemented; add `express-rate-limit` before public deployment
- **Input Validation**: All routes use Zod; enforce `targetLengthSec <= 600`, `topic <= 500 chars`

See [SECURITY.md](SECURITY.md) for full recommendations.

### Environment Variables
```bash
OPENAI_API_KEY=sk-...           # Required for plan generation, TTS, image generation
DATABASE_URL=file:./app.db      # SQLite (use PostgreSQL in production)
ARTIFACTS_DIR=./artifacts       # Where rendered videos are stored
NODE_ENV=production             # Activates security validations
ALLOWED_ORIGINS=https://yourdomain.com  # CORS whitelist
```

See `.env.example` for complete list.

### Render Pipeline Reliability
- **Idempotent steps**: Pipeline saves state after each step; can resume from failures
- **Timeout protection**: FFmpeg (5 min), probe (30 sec), version check (10 sec)
- **Artifact verification**: [apps/server/src/services/render/verifyArtifacts.ts](apps/server/src/services/render/verifyArtifacts.ts) validates all outputs before marking complete
- **Cancellation**: Active runs tracked in Map; `cancelRun()` sets flag, pipeline checks before each step

## Key Files by Purpose

| Purpose | Files |
|---------|-------|
| REST API routes | [apps/server/src/routes/](apps/server/src/routes/) |
| Plan generation logic | [apps/server/src/services/plan/planGenerator.ts](apps/server/src/services/plan/planGenerator.ts) |
| Render orchestration | [apps/server/src/services/render/renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts) |
| FFmpeg integration | [apps/server/src/services/ffmpeg/ffmpegUtils.ts](apps/server/src/services/ffmpeg/ffmpegUtils.ts) |
| React pages | [apps/web/src/pages/](apps/web/src/pages/) (Output, PlanStudio, Projects, QuickCreate, RenderQueue) |
| API client | [apps/web/src/api/client.ts](apps/web/src/api/client.ts) |
| Database schema | [apps/server/prisma/schema.prisma](apps/server/prisma/schema.prisma) |
| Test setup | [apps/server/tests/setup.ts](apps/server/tests/setup.ts) |

## Common Development Tasks

**Add a new API endpoint:**
1. Create route in [apps/server/src/routes/](apps/server/src/routes/)
2. Add Zod schema in [apps/server/src/utils/apiSchemas.ts](apps/server/src/utils/apiSchemas.ts)
3. Register in [apps/server/src/index.ts](apps/server/src/index.ts)
4. Test with Playwright or Vitest

**Modify plan generation:**
- Edit niche pack templates in [apps/server/src/services/nichePacks.ts](apps/server/src/services/nichePacks.ts)
- Test with `npm run test` (mocked mode)
- Verify pacing with various `targetLengthSec` values

**Change database schema:**
- Edit [apps/server/prisma/schema.prisma](apps/server/prisma/schema.prisma)
- Run `npm run db:migrate:dev` to create migration
- Commit both schema and migration file

**Debug render failures:**
- Use `APP_RENDER_DRY_RUN=1` to test without paid APIs
- Check logs in `Run.logsJson` (JSON array of step messages)
- Use `APP_DRY_RUN_FAIL_STEP=<step>` to simulate specific failures

## Recent Fixes (Jan 2026)

- Fixed CORS vulnerability (no longer allows all origins in production)
- Fixed path traversal vulnerability in artifact downloads
- Protected all JSON.parse calls with try-catch
- Added FFmpeg timeout protection
- Enhanced Zod input validation with length/range constraints
- Fixed memory leaks in React components

See [FIX_SUMMARY.md](FIX_SUMMARY.md) and [AUDIT_REPORT.md](AUDIT_REPORT.md) for full details.
