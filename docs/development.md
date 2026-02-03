# Development Guide

Developer workflow, code structure, and best practices for contributing to TikTok-AI-Agent.

## Table of Contents

- [Quick Reference](#quick-reference)
- [npm Scripts](#npm-scripts)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Hot Reload & Debugging](#hot-reload--debugging)
- [Adding Features](#adding-features)
- [Modifying Niche Packs](#modifying-niche-packs)
- [Database Migrations](#database-migrations)
- [Code Style](#code-style)
- [Git Workflow](#git-workflow)
- [Performance Optimization](#performance-optimization)

---

## Quick Reference

```bash
# Development
npm run dev              # Start server + web with hot reload
npm run dev:server       # Start backend only (port 3001)
npm run dev:web          # Start frontend only (port 5173)

# Building
npm run build            # Build both apps for production
npm run typecheck        # TypeScript validation
npm run lint             # ESLint (check only)
npm run lint:fix         # ESLint with auto-fix
npm run check            # lint + typecheck

# Testing
npm run test             # Unit tests (Vitest + Supertest)
npm run test:render      # Render pipeline dry-run tests
npm run test:e2e         # Playwright E2E tests

# Database
npm run db:generate      # Generate Prisma Client
npm run db:migrate:dev   # Create migration
npm run db:seed          # Seed test data
npm run db:studio        # Open Prisma Studio (localhost:5555)
```

---

## npm Scripts

### Development Scripts

| Script | Description | Ports | Hot Reload |
|--------|-------------|-------|------------|
| `npm run dev` | Start both server and web concurrently | 3001, 5173 | ✅ Both |
| `npm run dev:server` | Backend only (Express + TypeScript) | 3001 | ✅ Via tsx watch |
| `npm run dev:web` | Frontend only (React + Vite) | 5173 | ✅ Via Vite HMR |

**Implementation:**

```json
// package.json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:web\"",
    "dev:server": "npm run dev --workspace=apps/server",
    "dev:web": "npm run dev --workspace=apps/web"
  }
}

// apps/server/package.json
{
  "scripts": {
    "dev": "tsx watch --clear-screen=false src/index.ts"
  }
}

// apps/web/package.json
{
  "scripts": {
    "dev": "vite"
  }
}
```

### Build & Production Scripts

| Script | Description | Output |
|--------|-------------|--------|
| `npm run build` | Build both apps | `apps/server/dist/`, `apps/web/dist/` |
| `npm run start` | Start production server | Port from `PORT` env var |
| `npm run prestart` | Auto-run migrations before start | - |

**Production Build:**

```bash
# Build frontend and backend
npm run build

# Start production server (runs prestart hook)
npm start
```

### Testing Scripts

| Script | Description | Provider Calls |
|--------|-------------|----------------|
| `npm run test` | Unit + integration tests | ❌ Mocked (APP_TEST_MODE=1) |
| `npm run test:only` | Same, skip Prisma generate | ❌ Mocked |
| `npm run test:render` | Render pipeline tests | ❌ Dry-run (empty files) |
| `npm run test:render:only` | Same, skip Prisma generate | ❌ Dry-run |
| `npm run test:e2e` | Playwright E2E tests | ✅ Real API calls |
| `npm run render:smoke` | Single render smoke test | ✅ Real API calls |

**Test Configuration:**

```typescript
// apps/server/tests/setup.ts
process.env.APP_TEST_MODE ??= '1';        // Mock all OpenAI calls
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'file:./test.db';
```

### Quality Assurance Scripts

| Script | Description | Auto-fix |
|--------|-------------|----------|
| `npm run lint` | ESLint check | ❌ |
| `npm run lint:fix` | ESLint with fixes | ✅ |
| `npm run format` | Prettier format | ✅ |
| `npm run format:check` | Prettier check only | ❌ |
| `npm run typecheck` | TypeScript validation | ❌ |
| `npm run check` | lint + typecheck | ❌ |

**Pre-commit Hook:**

```bash
# .husky/pre-commit (runs lint-staged automatically)
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Database Scripts

| Script | Description | When to Use |
|--------|-------------|-------------|
| `npm run db:generate` | Generate Prisma Client | After schema changes, after `npm install` |
| `npm run db:migrate:dev` | Create new migration | After editing `schema.prisma` |
| `npm run db:migrate` | Deploy migrations (production) | Before `npm start` |
| `npm run db:seed` | Populate test data | Fresh database, testing |
| `npm run db:studio` | Visual database editor | Inspecting/editing data |

---

## Project Structure

```
TikTok-AI-Agent/
├── apps/
│   ├── server/                 # Backend (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints (project, run, plan, scene, etc.)
│   │   │   ├── services/       # Business logic
│   │   │   │   ├── plan/       # AI plan generation
│   │   │   │   ├── render/     # Render pipeline orchestration
│   │   │   │   ├── ffmpeg/     # Video composition utilities
│   │   │   │   ├── captions/   # ASS subtitle generation
│   │   │   │   ├── providers/  # OpenAI/ElevenLabs integrations
│   │   │   │   └── qa/         # Quality assurance validation
│   │   │   ├── db/             # Prisma client singleton
│   │   │   ├── utils/          # Shared utilities (logger, schemas, types)
│   │   │   ├── env.ts          # Environment variable configuration
│   │   │   └── index.ts        # Express app entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   ├── migrations/     # Migration history
│   │   │   └── seed.ts         # Test data seeder
│   │   ├── tests/              # Vitest + Supertest tests
│   │   └── package.json
│   │
│   └── web/                    # Frontend (React + TypeScript + Vite)
│       ├── src/
│       │   ├── pages/          # Route components (Projects, PlanStudio, Output, etc.)
│       │   ├── components/     # Reusable UI components
│       │   ├── api/            # API client (fetch wrapper)
│       │   ├── hooks/          # Custom React hooks
│       │   ├── utils/          # Frontend utilities
│       │   ├── App.tsx         # React Router setup
│       │   └── main.tsx        # React entry point
│       ├── tests/
│       │   └── e2e/            # Playwright E2E tests
│       └── package.json
│
├── docs/                       # Documentation (this file)
├── scripts/                    # Build & utility scripts
├── .husky/                     # Git hooks (pre-commit)
├── .cursor/                    # Cursor IDE rules
├── package.json                # Root workspace config
├── .env.example                # Environment variable template
└── tsconfig.json               # TypeScript config
```

### Key Directories

#### `apps/server/src/routes/`

API route definitions. Each file exports an Express `Router`:

```typescript
// apps/server/src/routes/project.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';

export const projectRoutes = Router();

projectRoutes.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({ /* ... */ });
  res.json(projects);
});

projectRoutes.post('/', async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error });
  }
  // ...
});
```

**Routes:**
- `project.ts` (332 lines) - CRUD operations, plan generation
- `run.ts` (611 lines) - Render execution, SSE streaming, analytics
- `plan.ts` (522 lines) - Plan versioning, approval
- `scene.ts` (186 lines) - Scene editing
- `automate.ts` (158 lines) - Batch automation
- `topicSuggestions.ts` (56 lines) - AI topic suggestions
- `status.ts` (38 lines) - Health check, provider status

#### `apps/server/src/services/`

Business logic isolated from routes:

```
services/
├── plan/
│   ├── planGenerator.ts        # OpenAI GPT-4 plan generation
│   ├── scriptTemplates.ts      # Template strategies (top5, myth_vs_fact)
│   └── promptBuilder.ts        # System prompt construction
├── render/
│   ├── renderPipeline.ts       # 7-step render orchestration
│   ├── verifyArtifacts.ts      # Post-render validation
│   └── renderQueue.ts          # Queue management (max 1 concurrent)
├── ffmpeg/
│   └── ffmpegUtils.ts          # Video/audio composition, probing, timeouts
├── captions/
│   └── captionsBuilder.ts      # ASS subtitle generation from Whisper
├── providers/
│   └── openai.ts               # OpenAI API wrapper (TTS, images, transcription)
├── qa/
│   └── qaValidator.ts          # Quality assurance checks
└── nichePacks.ts               # 12 niche pack definitions
```

#### `apps/web/src/pages/`

React route components:

```typescript
// apps/web/src/pages/Projects.tsx
export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(setProjects);
  }, []);

  return (
    <div>
      {projects.map(p => <ProjectCard key={p.id} project={p} />)}
    </div>
  );
}
```

**Pages:**
- `Projects.tsx` - Project list
- `QuickCreate.tsx` - Single-topic quick creation
- `PlanStudio.tsx` - Plan editing interface
- `RenderQueue.tsx` - Live render progress (SSE)
- `Output.tsx` - Final video player + analytics

---

## Development Workflow

### 1. Start Development Servers

```bash
npm run dev
```

**Output:**

```
[server] Server listening on http://localhost:3001
[server] Database connected: file:./dev.db
[web] VITE v5.1.6  ready in 234 ms
[web] ➜  Local:   http://localhost:5173/
```

### 2. Make Code Changes

**Backend changes** trigger automatic restart:

```typescript
// apps/server/src/routes/project.ts
projectRoutes.get('/', async (req, res) => {
  console.log('Fetching projects...'); // <-- Add logging
  const projects = await prisma.project.findMany({ /* ... */ });
  res.json(projects);
});
```

**Frontend changes** trigger HMR (instant update, no page reload):

```tsx
// apps/web/src/pages/Projects.tsx
<h1>My Projects</h1>  {/* <-- Update heading */}
```

### 3. Test Changes

```bash
# Run unit tests (fast, mocked)
npm run test

# Run E2E tests (slow, real API calls)
npm run test:e2e
```

### 4. Lint & Format

```bash
# Check code style
npm run lint

# Auto-fix issues
npm run lint:fix

# Format with Prettier
npm run format
```

### 5. Commit Changes

```bash
git add .
git commit -m "Add project logging"
```

Pre-commit hook automatically runs `lint-staged` (lints and formats staged files).

---

## Hot Reload & Debugging

### Backend Hot Reload

**How it works:**

```json
// apps/server/package.json
{
  "scripts": {
    "dev": "tsx watch --clear-screen=false src/index.ts"
  }
}
```

`tsx watch` monitors `.ts` files and restarts the server on changes. Preserves database connections.

### Frontend Hot Module Replacement

**How it works:**

Vite's HMR updates React components without full page reload. State is preserved where possible.

**Example:**

```tsx
// Edit this file while server is running
export default function Counter() {
  const [count, setCount] = useState(0); // State preserved during HMR
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:server"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

**Usage:**

1. Set breakpoints in `.ts` files
2. Press F5 or click "Debug Server"
3. Debugger pauses at breakpoints

---

## Adding Features

### Example: Add New API Endpoint

**1. Define Zod schema:**

```typescript
// apps/server/src/utils/apiSchemas.ts
export const createProjectSchema = z.object({
  topic: z.string().min(1).max(500),
  nichePackId: z.string().min(1),
  voicePreset: z.string().min(1).max(50),
  tempo: z.enum(['slow', 'normal', 'fast']),
}).strict();
```

**2. Create route:**

```typescript
// apps/server/src/routes/project.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { createProjectSchema } from '../utils/apiSchemas.js';

export const projectRoutes = Router();

projectRoutes.post('/', async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      details: parsed.error.flatten(),
    });
  }

  const project = await prisma.project.create({
    data: parsed.data,
  });

  res.status(201).json(project);
});
```

**3. Register route:**

```typescript
// apps/server/src/index.ts
import { projectRoutes } from './routes/project.js';

app.use('/api/projects', projectRoutes);
```

**4. Test:**

```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"topic":"Horror stories","nichePackId":"horror","voicePreset":"onyx","tempo":"slow"}'
```

**5. Add frontend client:**

```typescript
// apps/web/src/api/client.ts
export async function createProject(data: {
  topic: string;
  nichePackId: string;
  voicePreset: string;
  tempo: string;
}) {
  return fetchApi<Project>('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
```

---

## Modifying Niche Packs

Niche packs define style, pacing, effects, and caption styling for each content category (horror, facts, motivation, etc.).

**File:** `apps/server/src/services/nichePacks.ts`

### Structure

```typescript
export interface NichePack {
  id: string;
  name: string;
  description: string;
  effectsProfile: {
    allowedEffects: EffectType[];
    defaultEffect: EffectType;
  };
  scenePacing: {
    [targetLength: number]: {
      minScenes: number;
      maxScenes: number;
      minDurationSec: number;
      maxDurationSec: number;
    };
  };
  styleBiblePrompt: string;       // Visual style instructions
  globalNegativePrompt: string;   // Words to exclude from DALL-E
  hookRules: string[];            // Hook generation guidelines
  captionStyle: CaptionStyle;     // Font, colors, positioning
}
```

### Example: Modify Horror Pack

```typescript
// apps/server/src/services/nichePacks.ts
const horrorPack: NichePack = {
  id: 'horror',
  name: 'Horror & Mystery',
  description: 'Dark, suspenseful, and terrifying stories',

  // Change allowed effects
  effectsProfile: {
    allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'glitch', 'flash_cut', 'fade'],
    defaultEffect: 'slow_zoom_in',
  },

  // Adjust pacing for 60s videos
  scenePacing: {
    60: {
      minScenes: 6,
      maxScenes: 8,
      minDurationSec: 6,    // Increase from 5s
      maxDurationSec: 10,   // Decrease from 12s
    },
    // ... other lengths
  },

  // Update visual style
  styleBiblePrompt: `
    Dark, eerie, cinematic horror style with fog and shadows.
    Color palette: desaturated blues, grays, deep reds.
    NEW: Add grain and vignette for vintage horror look.
  `,

  // Add forbidden words
  globalNegativePrompt: 'blurry, low quality, watermark, text, cartoon, anime',

  // Modify hook rules
  hookRules: [
    'Start with chilling statement or question',
    'Use specific numbers (e.g., "5 haunted locations")',
    'NEW: Include sensory details (sounds, smells)',
  ],

  // Update caption styling
  captionStyle: {
    fontFamily: 'Impact',              // Change from Arial Black
    fontSize: 56,                      // Increase from 48
    primaryColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 5,                   // Increase from 4
    highlightColor: '#FF0000',         // Change from gold to red
    marginBottom: 180,                 // Move up from 200
    marginHorizontal: 30,              // Reduce from 40
  },
};
```

### Testing Niche Pack Changes

```bash
# 1. Restart server (picks up changes)
npm run dev:server

# 2. Create project with modified niche pack
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "5 haunted asylums",
    "nichePackId": "horror",
    "targetLengthSec": 60
  }'

# 3. Generate plan and inspect scenes
# Check effectPreset, durationTargetSec, visualPrompt
```

---

## Database Migrations

### When to Create Migration

- Added/removed model
- Added/removed field
- Changed field type
- Added index or constraint

### Create Migration

**1. Edit schema:**

```prisma
// apps/server/prisma/schema.prisma
model Project {
  id String @id @default(uuid())
  title String
  // NEW: Add thumbnail URL field
  thumbnailUrl String?
  // ... other fields
}
```

**2. Generate migration:**

```bash
npm run db:migrate:dev
```

**Prompt:**

```
✔ Enter a name for the new migration: … add_thumbnail_url_to_project
```

**Output:**

```
Applying migration `20260129120000_add_thumbnail_url_to_project`
✔ Generated Prisma Client
```

**3. Migration file created:**

```sql
-- apps/server/prisma/migrations/20260129120000_add_thumbnail_url_to_project/migration.sql
ALTER TABLE "Project" ADD COLUMN "thumbnailUrl" TEXT;
```

**4. Update TypeScript usage:**

```typescript
// apps/server/src/routes/project.ts
const project = await prisma.project.create({
  data: {
    // ... other fields
    thumbnailUrl: null, // New field available
  },
});
```

### Migration Best Practices

- **Test locally first:** Run migration on development database before production
- **Backup production:** Always backup before running migrations
- **Review SQL:** Check generated SQL in `migrations/` folder
- **Commit migrations:** Commit both `schema.prisma` and `migrations/` folder
- **Deploy atomically:** Run `npm run db:migrate` before starting new code

### Rollback Migration

Prisma doesn't support automatic rollback. Manual process:

```bash
# 1. Delete migration folder
rm -rf apps/server/prisma/migrations/20260129120000_add_thumbnail_url_to_project

# 2. Revert schema.prisma changes
git checkout apps/server/prisma/schema.prisma

# 3. Regenerate client
npm run db:generate

# 4. Drop and recreate database (development only!)
rm apps/server/dev.db
npm run db:migrate:dev
```

---

## Code Style

### ESLint Configuration

**File:** `eslint.config.mjs`

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### Prettier Configuration

**File:** `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100
}
```

### TypeScript Best Practices

**1. Always validate input with Zod:**

```typescript
// ✅ Good
const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: 'Invalid input', details: parsed.error });
}
const { topic, nichePackId } = parsed.data;

// ❌ Bad
const { topic, nichePackId } = req.body; // No validation
```

**2. Never use bare `JSON.parse()`:**

```typescript
// ✅ Good
let parsed = {};
try {
  parsed = JSON.parse(jsonString);
} catch (error) {
  console.error('Failed to parse JSON:', error);
  parsed = {};
}

// ❌ Bad
const parsed = JSON.parse(jsonString); // Throws on invalid JSON
```

**3. Use TypeScript types from Prisma:**

```typescript
// ✅ Good
import type { Project, Run } from '@prisma/client';

function processRun(run: Run) {
  // Type-safe access to run.status, run.progress, etc.
}

// ❌ Bad
function processRun(run: any) {
  // No type safety
}
```

---

## Git Workflow

### Branch Strategy

```bash
# Feature development
git checkout -b feature/add-script-templates
# ... make changes
git commit -m "Add script templates API"
git push origin feature/add-script-templates
# Open PR to main

# Bug fixes
git checkout -b fix/cors-validation
# ... make changes
git commit -m "Fix CORS origin validation"
git push origin fix/cors-validation
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code restructuring (no behavior change)
- `perf`: Performance improvement
- `test`: Add/update tests
- `chore`: Build/tooling changes

**Examples:**

```bash
git commit -m "feat(api): add channel presets endpoint"
git commit -m "fix(render): handle FFmpeg timeout gracefully"
git commit -m "docs: update configuration guide"
git commit -m "refactor(plan): extract prompt builder to separate file"
```

### Pre-commit Hook

Automatically runs on `git commit`:

```bash
# .husky/pre-commit
npx lint-staged
```

Lints and formats only staged files (fast).

---

## Performance Optimization

### Backend Optimization

**1. Database queries:**

```typescript
// ✅ Efficient - select only needed relations
const projects = await prisma.project.findMany({
  include: {
    planVersions: { take: 1, orderBy: { createdAt: 'desc' } },
    runs: { take: 1, orderBy: { createdAt: 'desc' } },
  },
});

// ❌ Inefficient - loads all relations
const projects = await prisma.project.findMany({
  include: { planVersions: true, runs: true },
});
```

**2. Caching:**

```typescript
// Cache AI responses in database
const cached = await prisma.cache.findUnique({
  where: { hashKey: hash(prompt) },
});
if (cached) {
  return JSON.parse(cached.resultJson);
}
```

**3. Streaming responses:**

```typescript
// SSE for long-running operations
res.setHeader('Content-Type', 'text/event-stream');
res.write(`data: ${JSON.stringify({ progress: 50 })}\n\n`);
```

### Frontend Optimization

**1. Lazy loading:**

```tsx
// Lazy load heavy components
const PlanStudio = lazy(() => import('./pages/PlanStudio'));
const Output = lazy(() => import('./pages/Output'));

<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/plan/:id" element={<PlanStudio />} />
    <Route path="/output/:runId" element={<Output />} />
  </Routes>
</Suspense>
```

**2. Debounce API calls:**

```tsx
const debouncedSearch = useMemo(
  () => debounce((query) => fetchTopicSuggestions(query), 300),
  []
);
```

**3. Memoize expensive renders:**

```tsx
const SceneList = memo(({ scenes }) => (
  <div>{scenes.map(s => <SceneCard key={s.id} scene={s} />)}</div>
));
```

---

## Related Documentation

- [setup.md](setup.md) - Initial setup
- [testing.md](testing.md) - Testing guide
- [api.md](api.md) - API reference
- [deployment.md](deployment.md) - Production deployment
- [AGENTS.md](../AGENTS.md) - AI agent instructions

---

**Last Updated:** 2026-01-29  
**Maintainers:** See [CONTRIBUTING.md](../CONTRIBUTING.md)
