# Quick Reference (30 seconds)

**Essential commands and patterns for TikTok-AI-Agent.**

## 🚀 Commands

```bash
npm install          # Install deps (both apps)
npm run dev          # Start server (3001) + web (5173)
npm run build        # Build both apps
npm run test         # Backend tests
npm run test:render  # Render tests (dry-run)
npm run test:e2e     # Playwright E2E
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run check        # lint + typecheck
```

## 📂 Key Files

- **`STATUS.md`** - Current priorities (read first!)
- **`AGENTS.md`** - AI agent instructions
- **`apps/server/src/routes/`** - API endpoints
- **`apps/server/src/services/`** - Business logic
- **`apps/web/src/pages/`** - React pages
- **`apps/web/src/api/client.ts`** - API client

## ✅ Validation Checklist

```typescript
// API route validation
const schema = z.object({
  field: z.string().min(1).max(100),
}).strict();

const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ 
    error: 'Invalid request', 
    details: parsed.error.flatten() 
  });
}
```

## 🔒 Security Rules

- ✅ Validate all inputs with Zod
- ✅ Use `schema.safeParse()`, never `parse()`
- ✅ Wrap `JSON.parse()` in try/catch
- ✅ Validate UUID path params: `z.string().uuid()`
- ❌ No `any` types
- ❌ No TODOs/placeholders in commits
- ❌ No hardcoded secrets

## 🎯 Data Flow

```
Topic → Plan (AI) → Studio (Edit) → Render (7 steps) → MP4
```

Render steps:
1. `tts_generate` - Voice-over
2. `asr_align` - Whisper transcription
3. `images_generate` - DALL-E visuals
4. `captions_build` - ASS subtitles
5. `music_build` - Background audio
6. `ffmpeg_render` - Video composition
7. `finalize_artifacts` - MP4 + thumbnail

## 📝 Common Patterns

### API Client Call

```typescript
try {
  const data = await apiClient.createProject(topic, nichePackId);
  setProject(data);
} catch (error) {
  setError(getErrorMessage(error));
}
```

### Prisma Query

```typescript
import { prisma } from 'db/client'; // Use singleton

const project = await prisma.project.findUnique({
  where: { id },
  include: { planVersions: { include: { scenes: true } } }
});
```

### Database Migration

```bash
# 1. Edit schema.prisma
# 2. Create migration
npm run db:migrate:dev
# 3. Name it descriptively
```

## 🐛 Debugging

### Render Failures
1. Check `Run.status` and `Run.logsJson`
2. Use dry-run: `APP_RENDER_DRY_RUN=1 npm run test:render`
3. Simulate failure: `APP_DRY_RUN_FAIL_STEP=<step>`

### Test Failures
```bash
npm test -- <filename>        # Run single file
npm run test:coverage         # Coverage report
APP_TEST_MODE=1 npm run test  # Mocked mode
```

## 📚 More Info

- **Project layout:** [.cursor/docs/project-layout.md](.cursor/docs/project-layout.md)
- **Common pitfalls:** [.cursor/docs/common-pitfalls.md](.cursor/docs/common-pitfalls.md)
- **Decision trees:** [.cursor/docs/decision-trees.md](.cursor/docs/decision-trees.md)
- **Full instructions:** [.github/copilot-instructions.md](../.github/copilot-instructions.md)
