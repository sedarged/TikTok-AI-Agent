# Data Model Reference

Database schema documentation for TikTok-AI-Agent using Prisma ORM.

## Table of Contents

- [Overview](#overview)
- [Models](#models)
- [Relationships](#relationships)
- [Migrations](#migrations)
- [Indexes](#indexes)
- [SQLite vs PostgreSQL](#sqlite-vs-postgresql)

---

## Overview

**ORM:** Prisma 5.x  
**Development Database:** SQLite  
**Production Database:** PostgreSQL (recommended)  
**Schema File:** `apps/server/prisma/schema.prisma`

```mermaid
erDiagram
    Project ||--o{ PlanVersion : has
    Project ||--o{ Run : has
    PlanVersion ||--o{ Scene : contains
    PlanVersion ||--o{ Run : uses
    Run }o--|| Project : belongs_to
    Run }o--|| PlanVersion : uses
```

---

## Models

### Project

Container for video project with configuration.

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | String (UUID) | ✅ | uuid() | Primary key |
| `title` | String | ✅ | - | Project title |
| `topic` | String | ✅ | - | Video topic (1-500 chars) |
| `nichePackId` | String | ✅ | - | Niche pack identifier |
| `language` | String | ❌ | "en" | Language code |
| `targetLengthSec` | Int | ❌ | 60 | Target video length (seconds) |
| `tempo` | String | ❌ | "normal" | Pacing: slow/normal/fast |
| `voicePreset` | String | ❌ | "alloy" | TTS voice name |
| `visualStylePreset` | String? | ❌ | null | Visual style override |
| `seoKeywords` | String? | ❌ | null | Comma-separated keywords |
| `status` | String | ❌ | "DRAFT_PLAN" | Workflow status |
| `latestPlanVersionId` | String? | ❌ | null | Reference to latest plan |
| `createdAt` | DateTime | ✅ | now() | Creation timestamp |
| `updatedAt` | DateTime | ✅ | now() | Last update timestamp |

**Status Values:**

- `DRAFT_PLAN` - Initial state, no plan generated
- `PLAN_READY` - Plan generated, awaiting approval
- `APPROVED` - Plan approved, ready to render
- `RENDERING` - Active render in progress
- `DONE` - Render completed successfully
- `FAILED` - Render failed

**Prisma Schema:**

```prisma
model Project {
  id                  String    @id @default(uuid())
  title               String
  topic               String
  nichePackId         String
  language            String    @default("en")
  targetLengthSec     Int       @default(60)
  tempo               String    @default("normal")
  voicePreset         String    @default("alloy")
  visualStylePreset   String?
  seoKeywords        String?
  status              String    @default("DRAFT_PLAN")
  latestPlanVersionId String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  planVersions PlanVersion[]
  runs         Run[]
}
```

### PlanVersion

Immutable snapshot of AI-generated plan.

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | String (UUID) | ✅ | uuid() | Primary key |
| `projectId` | String (UUID) | ✅ | - | Parent project |
| `hookOptionsJson` | String | ❌ | "[]" | JSON array of 5 hook options |
| `hookSelected` | String | ❌ | "" | Selected hook text |
| `outline` | String | ❌ | "" | Video outline |
| `scriptFull` | String | ❌ | "" | Full script text |
| `scriptTemplateId` | String? | ❌ | null | Template used (top5, myth_vs_fact) |
| `estimatesJson` | String | ❌ | "{}" | JSON: wpm, estimatedLengthSec |
| `validationJson` | String | ❌ | "{}" | JSON: errors, warnings, suggestions |
| `createdAt` | DateTime | ✅ | now() | Creation timestamp |

**Prisma Schema:**

```prisma
model PlanVersion {
  id              String   @id @default(uuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  hookOptionsJson String   @default("[]")
  hookSelected    String   @default("")
  outline         String   @default("")
  scriptFull      String   @default("")
  scriptTemplateId String?
  estimatesJson   String   @default("{}")
  validationJson  String   @default("{}")

  scenes Scene[]
  runs   Run[]
}
```

### Scene

Individual video segment with narration and visual.

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | String (UUID) | ✅ | uuid() | Primary key |
| `projectId` | String (UUID) | ✅ | - | Parent project |
| `planVersionId` | String (UUID) | ✅ | - | Parent plan version |
| `idx` | Int | ✅ | - | Scene order (0-based) |
| `narrationText` | String | ❌ | "" | Voice-over text |
| `onScreenText` | String | ❌ | "" | Text overlay (optional) |
| `visualPrompt` | String | ❌ | "" | DALL-E image prompt |
| `negativePrompt` | String | ❌ | "" | DALL-E negative prompt |
| `effectPreset` | String | ❌ | "slow_zoom_in" | FFmpeg effect |
| `durationTargetSec` | Float | ❌ | 5.0 | Target duration |
| `startTimeSec` | Float | ❌ | 0.0 | Start time in video |
| `endTimeSec` | Float | ❌ | 5.0 | End time in video |
| `isLocked` | Boolean | ❌ | false | Prevent auto-regeneration |
| `updatedAt` | DateTime | ✅ | now() | Last update timestamp |

**Effect Presets:**

`slow_zoom_in`, `slow_zoom_out`, `pan_left`, `pan_right`, `tilt_up`, `tilt_down`, `flash_cut`, `fade`, `glitch`, `static`

**Prisma Schema:**

```prisma
model Scene {
  id              String   @id @default(uuid())
  projectId       String
  planVersionId   String
  planVersion     PlanVersion @relation(fields: [planVersionId], references: [id], onDelete: Cascade)
  idx             Int
  narrationText   String   @default("")
  onScreenText    String   @default("")
  visualPrompt    String   @default("")
  negativePrompt  String   @default("")
  effectPreset    String   @default("slow_zoom_in")
  durationTargetSec Float  @default(5.0)
  startTimeSec    Float    @default(0.0)
  endTimeSec      Float    @default(5.0)
  isLocked        Boolean  @default(false)
  updatedAt       DateTime @updatedAt
}
```

### Run

Render execution with progress tracking.

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | String (UUID) | ✅ | uuid() | Primary key |
| `projectId` | String (UUID) | ✅ | - | Parent project |
| `planVersionId` | String (UUID) | ✅ | - | Plan version to render |
| `status` | String | ❌ | "queued" | Execution status |
| `progress` | Int | ❌ | 0 | Progress percentage (0-100) |
| `currentStep` | String | ❌ | "" | Current pipeline step |
| `logsJson` | String | ❌ | "[]" | JSON array of log entries |
| `artifactsJson` | String | ❌ | "{}" | JSON: mp4Path, thumbPath, etc. |
| `resumeStateJson` | String | ❌ | "{}" | JSON: lastCompletedStep |
| `views` | Int? | ❌ | null | View count (analytics) |
| `likes` | Int? | ❌ | null | Like count (analytics) |
| `retention` | Float? | ❌ | null | Retention rate (0-1) |
| `postedAt` | DateTime? | ❌ | null | Publish timestamp |
| `scheduledPublishAt` | DateTime? | ❌ | null | Scheduled publish time |
| `publishedAt` | DateTime? | ❌ | null | Actual publish time |
| `createdAt` | DateTime | ✅ | now() | Creation timestamp |
| `updatedAt` | DateTime | ✅ | now() | Last update timestamp |

**Status Values:**

- `queued` - Waiting to start
- `running` - Active render
- `done` - Completed successfully
- `failed` - Render failed
- `canceled` - Manually canceled
- `qa_failed` - Failed QA validation

**Pipeline Steps (in order):**

1. `tts_generate` - Generate voice-over audio
2. `asr_align` - Whisper transcription for captions
3. `images_generate` - DALL-E image generation
4. `captions_build` - Build ASS subtitle file
5. `music_build` - Add background music
6. `ffmpeg_render` - Compose final video
7. `finalize_artifacts` - Verify outputs

**Prisma Schema:**

```prisma
model Run {
  id              String   @id @default(uuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  planVersionId   String
  planVersion     PlanVersion @relation(fields: [planVersionId], references: [id], onDelete: Cascade)
  status          String   @default("queued")
  progress        Int      @default(0)
  currentStep     String   @default("")
  logsJson        String   @default("[]")
  artifactsJson   String   @default("{}")
  resumeStateJson String   @default("{}")
  views          Int?
  likes          Int?
  retention      Float?
  postedAt      DateTime?
  scheduledPublishAt DateTime?
  publishedAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Cache

AI response cache for cost reduction.

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | String (UUID) | ✅ | uuid() | Primary key |
| `kind` | String | ✅ | - | Cache type: llm/images/tts/asr |
| `hashKey` | String (unique) | ✅ | - | Hash of request parameters |
| `resultJson` | String | ❌ | "{}" | JSON response |
| `payloadPath` | String? | ❌ | null | File path for binary data |
| `createdAt` | DateTime | ✅ | now() | Cache timestamp |

**Prisma Schema:**

```prisma
model Cache {
  id          String   @id @default(uuid())
  kind        String
  hashKey     String   @unique
  resultJson  String   @default("{}")
  payloadPath String?
  createdAt   DateTime @default(now())
}
```

---

## Relationships

```typescript
// One-to-Many
Project → PlanVersion (cascade delete)
Project → Run (cascade delete)
PlanVersion → Scene (cascade delete)
PlanVersion → Run (cascade delete)

// Foreign Keys
Scene.planVersionId → PlanVersion.id (onDelete: Cascade)
Run.projectId → Project.id (onDelete: Cascade)
Run.planVersionId → PlanVersion.id (onDelete: Cascade)
```

**Cascade Behavior:**

Deleting a Project deletes all related PlanVersions, Scenes, and Runs.

---

## Migrations

### Creating Migrations

```bash
# Edit schema
nano apps/server/prisma/schema.prisma

# Generate migration
npm run db:migrate:dev
# Enter migration name: "add_thumbnail_url"

# Generated files:
# apps/server/prisma/migrations/20260129120000_add_thumbnail_url/migration.sql
```

### Applying Migrations

```bash
# Development
npm run db:migrate:dev

# Production
npm run db:migrate  # Runs prisma migrate deploy
```

### Migration Example

```sql
-- apps/server/prisma/migrations/20260129120000_add_thumbnail_url/migration.sql
ALTER TABLE "Project" ADD COLUMN "thumbnailUrl" TEXT;
```

---

## Indexes

**Current Indexes:**

- `Cache.hashKey` - Unique index for cache lookups
- Primary keys on all `id` fields (automatic)

**Recommended Production Indexes:**

```sql
CREATE INDEX idx_project_status ON "Project"(status);
CREATE INDEX idx_run_status ON "Run"(status);
CREATE INDEX idx_run_created_at ON "Run"("createdAt" DESC);
CREATE INDEX idx_scene_plan_version ON "Scene"("planVersionId", idx);
```

---

## SQLite vs PostgreSQL

### SQLite (Development)

**Advantages:**

- Zero configuration
- File-based (no server)
- Fast for single-user

**Limitations:**

- Limited concurrency (database locks)
- No advanced features (full-text search, JSON operators)
- Not suitable for production

**Configuration:**

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

```bash
DATABASE_URL=file:./dev.db
```

### PostgreSQL (Production)

**Advantages:**

- Full ACID compliance
- High concurrency
- Advanced features (JSON, full-text search)
- Production-ready

**Configuration:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_ai
```

**Migration Steps:**

See [deployment.md#database-migration](deployment.md#database-migration)

---

## Related Documentation

- [api.md](api.md) - API reference
- [development.md](development.md#database-migrations) - Creating migrations
- [deployment.md](deployment.md#database-migration) - PostgreSQL setup

---

**Last Updated:** 2026-01-29  
**Prisma Version:** 5.x
