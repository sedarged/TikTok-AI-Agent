# Project Layout

**Quick reference for AI agents working on TikTok-AI-Agent.**

## Repository Structure

```
TikTok-AI-Agent/
├── apps/
│   ├── server/          # Backend (Express + TypeScript)
│   │   ├── prisma/      # Database schema & migrations
│   │   ├── src/
│   │   │   ├── routes/  # API endpoints (project, plan, run, etc.)
│   │   │   ├── services/
│   │   │   │   ├── plan/        # AI plan generation (OpenAI GPT-4)
│   │   │   │   ├── render/      # Video render pipeline (7 steps)
│   │   │   │   ├── ffmpeg/      # FFmpeg utilities
│   │   │   │   ├── captions/    # Caption generation (Whisper ASR)
│   │   │   │   └── providers/   # OpenAI, ElevenLabs, etc.
│   │   │   ├── db/      # Prisma client singleton
│   │   │   ├── utils/   # Types, schemas, helpers
│   │   │   └── index.ts # Server entry, route registration
│   │   └── tests/       # Vitest unit & integration tests
│   │
│   └── web/             # Frontend (React + Vite + TypeScript)
│       ├── src/
│       │   ├── pages/   # React pages (Projects, PlanStudio, Output, RenderQueue)
│       │   ├── api/     # API client & types
│       │   ├── utils/   # Error handling, formatters
│       │   └── App.tsx  # Routes & layout
│       └── tests/e2e/   # Playwright E2E tests
│
├── docs/                # User-facing documentation
│   ├── README.md        # Docs index
│   ├── adr/             # Architecture Decision Records
│   ├── api.md           # API reference
│   ├── architecture.md  # System architecture
│   ├── deployment.md    # Deployment guides
│   └── ...
│
├── .cursor/             # AI agent configuration
│   ├── docs/            # AI-focused guides (this directory)
│   ├── rules/           # Cursor rules (always-applied & file-scoped)
│   ├── commands/        # Custom commands
│   └── skills/          # Agent Skills
│
├── .github/
│   ├── workflows/       # CI/CD (ci.yml, status-sync.yml, priority-label.yml)
│   ├── ISSUE_TEMPLATE/  # Issue forms
│   └── copilot-instructions.md  # GitHub Copilot instructions
│
├── STATUS.md            # Single source of truth for project status
├── AGENTS.md            # AI agent instructions
├── README.md            # Project overview
└── package.json         # Workspace root
```

## Key Directories

### Backend (`apps/server/`)

- **`routes/`** - API endpoints. Each file exports an Express router. Mounted in `index.ts`.
  - `project.ts` - Project CRUD operations
  - `plan.ts` - Plan generation and management
  - `run.ts` - Render execution and SSE streaming
  - `scene.ts` - Scene updates and regeneration
  - `automate.ts` - One-click workflow (project → plan → render)
  - `batch.ts` - Batch video creation (rate-limited)
  - `nichePack.ts` - Niche pack listing
  - `scriptTemplates.ts` - Script template listing
  - `topicSuggestions.ts` - AI-powered topic suggestions
  - `status.ts` - Provider status check
  - `test.ts` - Test routes (only in test/dry-run mode)
- **`services/`** - Business logic. Organized by domain (plan, render, ffmpeg, captions, providers).
- **`utils/apiSchemas.ts`** - Zod validation schemas for all API routes.
- **`utils/types.ts`** - Shared TypeScript types.
- **`db/client.ts`** - Prisma client singleton. Import from here, not `@prisma/client`.
- **`tests/`** - Vitest tests. Run with `npm run test` or `npm run test:render` (dry-run mode).

### Frontend (`apps/web/`)

- **`pages/`** - React page components. Routes defined in `App.tsx`.
  - `QuickCreate.tsx` - Single video creation (default route `/create`)
  - `BatchCreate.tsx` - Batch video creation (`/batch-create`)
  - `Projects.tsx` - Project list and management (`/projects`)
  - `PlanStudio.tsx` - Plan editing interface (`/project/:projectId/plan`)
  - `RenderQueue.tsx` - Render status and queue (`/project/:projectId/runs`)
  - `Output.tsx` - Video output and preview (`/run/:runId`)
  - `Analytics.tsx` - Performance dashboard (`/analytics`)
  - `Calendar.tsx` - Content scheduling (`/calendar`)
- **`api/client.ts`** - API client functions. All backend calls go through here.
- **`api/types.ts`** - Frontend TypeScript types for API responses.
- **`utils/errors.ts`** - `getErrorMessage()` helper for user-facing error messages.

### Documentation (`docs/`)

User-facing docs. See [docs/README.md](../../docs/README.md) for full index.

### AI Configuration (`.cursor/`)

- **`docs/`** - This directory. AI-focused guides.
  - `project-layout.md` - Repository structure and file organization
  - `common-pitfalls.md` - Frequent mistakes and how to avoid them
  - `decision-trees.md` - Quick decision trees for common tasks
  - `test-modes.md` - Comprehensive test environment and mocking guide
  - `session-state.md` - Template for tracking multi-turn session context
- **`rules/`** - Cursor rules (MDC format). `alwaysApply: true` rules run on all files.
- **`commands/`** - Custom commands (e.g., `/validate`, `/add-api-endpoint`).
- **`skills/`** - Agent Skills (e.g., `add-api-endpoint`, `debug-render-failure`, `repo-audit`).

### GitHub Configuration (`.github/`)

- **`workflows/`** - CI/CD automation
  - `ci.yml` - Lint, typecheck, test, build on PR/push
  - `status-sync.yml` - Sync GitHub issues to STATUS.md (automated project status)
  - `priority-label.yml` - Auto-assign priority labels to issues
  - `pr-automation.yml` - PR checks and automation
  - `codecov.yml` - Code coverage reports
  - `release-please.yml` - Automated releases and changelog
- **`ISSUE_TEMPLATE/`** - Issue and PR templates
- **`copilot-instructions.md`** - GitHub Copilot instructions

## File Naming Conventions

- **Routes:** `apps/server/src/routes/<entity>.ts` (e.g., `project.ts`, `plan.ts`, `run.ts`)
- **Services:** `apps/server/src/services/<domain>/<name>.ts` (e.g., `plan/planGenerator.ts`)
- **Tests:** `<name>.test.ts` or `<name>.integration.test.ts`
- **Types:** Shared types in `utils/types.ts`; domain-specific in same file as implementation
- **React pages:** PascalCase (e.g., `PlanStudio.tsx`, `RenderQueue.tsx`)

## Import Paths

- **Absolute imports:** Configured in `tsconfig.json` (`baseUrl: "src"`)
- **Example:** `import { prisma } from 'db/client'` (not `../../db/client`)
- **Frontend:** No absolute imports; use relative paths

## Data Flow

1. **Plan Phase** - User provides topic → AI generates plan (hooks, outline, script, scenes)
2. **Studio Phase** - User edits/approves plan in UI
3. **Render Phase** - Pipeline executes 7 steps (TTS → ASR → Images → Captions → Music → FFmpeg → Finalize)

See [.github/copilot-instructions.md](../../.github/copilot-instructions.md) for detailed architecture.
