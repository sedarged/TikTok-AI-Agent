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
- **`services/`** - Business logic. Organized by domain (plan, render, ffmpeg, captions, providers).
- **`utils/apiSchemas.ts`** - Zod validation schemas for all API routes.
- **`utils/types.ts`** - Shared TypeScript types.
- **`db/client.ts`** - Prisma client singleton. Import from here, not `@prisma/client`.
- **`tests/`** - Vitest tests. Run with `npm run test` or `npm run test:render` (dry-run mode).

### Frontend (`apps/web/`)

- **`pages/`** - React page components. Routes defined in `App.tsx`.
- **`api/client.ts`** - API client functions. All backend calls go through here.
- **`api/types.ts`** - Frontend TypeScript types for API responses.
- **`utils/errors.ts`** - `getErrorMessage()` helper for user-facing error messages.

### Documentation (`docs/`)

User-facing docs. See [docs/README.md](../../docs/README.md) for full index.

### AI Configuration (`.cursor/`)

- **`docs/`** - This directory. AI-focused guides.
- **`rules/`** - Cursor rules (MDC format). `alwaysApply: true` rules run on all files.
- **`commands/`** - Custom commands (e.g., `/validate`).
- **`skills/`** - Agent Skills (e.g., `add-api-endpoint`, `debug-render-failure`).

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
