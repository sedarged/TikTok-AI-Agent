# TikTok-AI-Agent Deep Audit Report

## 1) Executive Summary

**Health Scores (0–10)**
- **Build:** 8/10 (build succeeds locally; Docker/CI not verified).
- **Tests:** 7/10 (unit/integration tests run; E2E/render tests not run here).
- **Security:** 3/10 (no auth/authz, IDOR risk, CSRF gaps).
- **Reliability:** 4/10 (in-memory queue/state, restart handling gaps, log races).
- **Code Quality:** 6/10 (some validation gaps and error handling issues).
- **Docs:** 6/10 (version mismatch + at least one incomplete deployment note).

## 2) Architecture Overview

**Runtime & Stack**
- **Backend:** Node.js + Express (TypeScript) with Prisma (SQLite). Entrypoint: `apps/server/src/index.ts`.
- **Frontend:** React + Vite + TypeScript. Entrypoint: `apps/web/src/main.tsx`.
- **AI providers:** OpenAI (chat, DALL·E, TTS, Whisper) via `apps/server/src/services/providers/openai.ts`.
- **Render pipeline:** `apps/server/src/services/render/renderPipeline.ts` (multi-step pipeline + SSE updates).

**Data & Flow Diagram (text)**

```
[Web UI] --(REST/SSE)--> [Express API]
   |                         |
   |                         |--> [Prisma + SQLite]
   |                         |--> [Render Pipeline]
   |                         |       |--> [OpenAI APIs]
   |                         |       |--> [FFmpeg]
   |                         |       |--> [Artifacts Dir]
   |                         |
   |<--(SSE progress)--------|
```

Key modules:
- **Routes:** `apps/server/src/routes/*` (project/plan/scene/run/etc.)
- **Services:** `apps/server/src/services/*` (plan generation, render, providers, QA)
- **DB schema:** `apps/server/prisma/schema.prisma`

## 3) Findings Table

| Severity | Area | Issue | Evidence (file:line) | Repro | Fix summary | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **BLOCKER** | Security | No authentication/authorization on any API route; all state-changing endpoints are public. | `apps/server/src/index.ts:133-148` | `curl -X POST http://localhost:3001/api/project -d '{...}'` works without auth. | Add auth middleware (JWT/session) + route-level access control. | Not fixed |
| **HIGH** | Security | IDOR risk: scene/plan updates accept arbitrary scene IDs without verifying plan/project ownership. | `apps/server/src/routes/plan.ts:119-146`, `apps/server/src/routes/scene.ts:52-125` | Use a scene ID from another project and update it through `/api/plan/:planVersionId` or `/api/scene/:sceneId`. | Validate scene ownership by planVersionId/projectId before update; enforce auth. | Not fixed |
| **HIGH** | Security | CSRF protection missing while CORS allows credentials; state-changing endpoints are vulnerable when cookies are introduced. | `apps/server/src/index.ts:98-117` | Host malicious page → browser auto-sends credentials for POST/PUT if cookies are added later. | Add CSRF tokens or same-site cookie strategy; disable credentials if not needed. | Not fixed |
| **HIGH** | Correctness | OpenAI JSON response format uses `json_object`, but prompts require JSON arrays; parsing can fail or produce invalid structures. | `apps/server/src/services/providers/openai.ts:63-96`, `apps/server/src/services/plan/planGenerator.ts:149-165`, `apps/server/src/services/trends/topicSuggestions.ts:31-45` | Run plan generation/topic suggestions with OpenAI key; model may return object instead of array (parse errors/fallbacks). | Use JSON schema or remove `json_object` for array responses; validate array shape explicitly. | Not fixed |
| **MED** | Correctness | Plan generation endpoint silently ignores invalid body payloads instead of returning 400. | `apps/server/src/routes/project.ts:153-155` | `POST /api/project/:id/plan` with `{ scriptTemplateId: 123 }` → proceeds as if body is empty. | Return 400 with validation errors when `safeParse` fails. | Not fixed |
| **MED** | Correctness | Plan autosave scene updates allow negative or zero durations; no UUID validation for scene IDs. | `apps/server/src/routes/plan.ts:17-27` | `PUT /api/plan/:planVersionId` with `durationTargetSec: -5` accepted and persisted. | Use `z.uuid()` for IDs and `.positive()` or `.min()` for durations. | Not fixed |
| **HIGH** | Reliability | Render queue is in-memory only. Queued runs are never resumed after restart. | `apps/server/src/services/render/renderPipeline.ts:90-113`, `apps/server/src/services/render/renderPipeline.ts:962-991` | Start two runs, restart server; second run remains `queued` forever. | Persist queue in DB or on startup enqueue queued runs. | Not fixed |
| **HIGH** | Reliability | Canceling a queued run does not remove it from the queue; `processNextInQueue` returns early and stalls subsequent runs. | `apps/server/src/services/render/renderPipeline.ts:97-113`, `apps/server/src/services/render/renderPipeline.ts:1083-1092` | Enqueue runs A/B, cancel A while queued; when A is popped, queue processing stops, B never runs. | Remove canceled run IDs from queue or loop until a queued run is found. | Not fixed |
| **MED** | Reliability | `addLog` reads/modifies/writes logs without transaction; parallel tasks can drop log entries. | `apps/server/src/services/render/renderPipeline.ts:466-520`, `apps/server/src/services/render/renderPipeline.ts:1128-1152` | Run render with multiple images → concurrent `addLog` calls can race and overwrite logs. | Append logs using DB atomic update or a separate Log table. | Not fixed |
| **MED** | Performance | No DB indexes for common query filters/order (e.g., `Run.status`, `scheduledPublishAt`, `projectId`). | `apps/server/prisma/schema.prisma:65-85` | Large run tables will cause slow reads for `/api/run` and `/api/run/upcoming`. | Add indexes on Run.status, Run.projectId, Run.scheduledPublishAt, createdAt. | Not fixed |
| **LOW** | Docs/DevEx | README says Node.js 18+ but engines require Node 20.19+ or 22.12+. | `README.md:100-103`, `package.json:43-45` | Follow README on Node 18 → engine mismatch or runtime incompatibility. | Update README to match engines or relax engines. | Not fixed |
| **LOW** | Docs/Security | Deployment guide includes an “add authentication later” placeholder for artifacts. | `docs/deployment.md:562-565` | N/A (documentation). | Update docs with actual auth strategy or remove placeholder. | Not fixed |

## 4) Detailed Findings

### BLOCKER — No authentication/authorization on API routes
- **Where:** `createApp()` mounts all `/api/*` routes without any auth middleware. (`apps/server/src/index.ts:133-148`)
- **Why it matters:** Anyone with network access can create, delete, or render projects and download artifacts.
- **Repro:** `curl -X DELETE http://localhost:3001/api/project/<id>` works without auth.
- **Safe fix:** Add authentication middleware (JWT/session) and enforce per-resource authorization checks.

### HIGH — IDOR: scene/plan update endpoints do not verify ownership
- **Where:** Plan autosave updates any scene by ID; scene endpoints operate purely on `sceneId` (no project/plan validation). (`apps/server/src/routes/plan.ts:119-146`, `apps/server/src/routes/scene.ts:52-125`)
- **Why it matters:** A user can modify another project’s scenes if they obtain IDs.
- **Repro:** Use a scene ID from another project and update via `/api/scene/:sceneId`.
- **Safe fix:** Verify scene belongs to the targeted plan/project before updating; require auth.

### HIGH — CSRF protection missing with credentialed CORS
- **Where:** CORS allows credentials; no CSRF tokens or same-site cookie strategy. (`apps/server/src/index.ts:98-117`)
- **Why it matters:** If cookies are used for auth later, cross-site POSTs can succeed.
- **Repro:** Host a malicious page that POSTs to `/api/project` while user is logged in.
- **Safe fix:** Add CSRF tokens or enforce `SameSite=Strict`/`Lax`, and disable credentials if unused.

### HIGH — OpenAI JSON format mismatch (arrays vs json_object)
- **Where:** `callOpenAI` sets `response_format: { type: 'json_object' }` for all JSON calls, but prompts demand arrays. (`apps/server/src/services/providers/openai.ts:63-96`, `apps/server/src/services/plan/planGenerator.ts:149-165`, `apps/server/src/services/trends/topicSuggestions.ts:31-45`)
- **Why it matters:** OpenAI may return an object wrapper or reject array output; parsing fails, falling back to templates or throwing errors.
- **Repro:** Run plan generation or topic suggestions with a real OpenAI key; observe parse errors or fallback.
- **Safe fix:** Switch to JSON schema responses or remove `json_object` for array outputs; validate array shape.

### MED — Invalid plan generation body ignored
- **Where:** `generatePlanBodySchema.safeParse` failure does not return 400; it proceeds with `{}`. (`apps/server/src/routes/project.ts:153-155`)
- **Why it matters:** Client bugs silently succeed; bad input is not surfaced.
- **Repro:** `POST /api/project/:id/plan` with invalid `scriptTemplateId` type.
- **Safe fix:** Return 400 with validation details when `safeParse` fails.

### MED — Scene updates allow negative/zero durations and non-UUID IDs
- **Where:** `sceneUpdateSchema` uses `id: z.string()` and `durationTargetSec: z.number()` (no min). (`apps/server/src/routes/plan.ts:17-27`)
- **Why it matters:** Invalid timing can break render math; bad IDs are silently ignored.
- **Repro:** Send `durationTargetSec: -5` in plan update; values persist.
- **Safe fix:** Use `z.uuid()` and `.positive()` (or `.min(0.1)`), plus server-side ownership checks.

### HIGH — In-memory queue lost after restart
- **Where:** `renderQueue` and `currentRunningRunId` are in-memory; restart logic only resets `running` runs. (`apps/server/src/services/render/renderPipeline.ts:90-113`, `apps/server/src/services/render/renderPipeline.ts:962-991`)
- **Why it matters:** Runs left in `queued` never resume after a server restart.
- **Repro:** Start two runs, restart server; queued run remains stuck.
- **Safe fix:** On startup, load queued runs from DB and resume queue processing.

### HIGH — Cancelled queued runs stall the queue
- **Where:** `cancelRun` does not remove run IDs from `renderQueue`; `processNextInQueue` exits if popped run is not `queued`. (`apps/server/src/services/render/renderPipeline.ts:97-113`, `apps/server/src/services/render/renderPipeline.ts:1083-1092`)
- **Why it matters:** One cancelled run can block all subsequent queued runs.
- **Repro:** Queue run B, cancel B before it starts, wait for queue to process → stalls.
- **Safe fix:** Skip non-queued runs in a loop or clean queue on cancel.

### MED — Log updates are race-prone
- **Where:** `addLog` reads `logsJson`, mutates, then writes; image generation runs tasks in parallel. (`apps/server/src/services/render/renderPipeline.ts:466-520`, `apps/server/src/services/render/renderPipeline.ts:1128-1152`)
- **Why it matters:** Parallel log writes can overwrite each other, losing data.
- **Repro:** Render with several scenes; compare logs for missing entries.
- **Safe fix:** Store logs in a dedicated table or use atomic JSON append (if supported).

### MED — Missing indexes for common query patterns
- **Where:** `Run` has filters/sorting on `status`, `projectId`, `scheduledPublishAt`, `createdAt`, but no indexes are declared. (`apps/server/prisma/schema.prisma:65-85`)
- **Why it matters:** Performance degrades as data grows.
- **Repro:** Populate many runs; `/api/run` and `/api/run/upcoming` become slow.
- **Safe fix:** Add Prisma indexes on those fields and run migrations.

### LOW — Node version mismatch in docs
- **Where:** README says Node 18+, but engines require Node 20.19+ or 22.12+. (`README.md:100-103`, `package.json:43-45`)
- **Why it matters:** Users follow README and hit engine/runtime issues.
- **Repro:** Use Node 18 and run `npm install`.
- **Safe fix:** Update README or relax engine constraint.

### LOW — Deployment doc placeholder for auth
- **Where:** Nginx snippet notes “add authentication later” for artifacts. (`docs/deployment.md:562-565`)
- **Why it matters:** Leaves a known security gap unaddressed in docs.
- **Repro:** N/A (documentation).
- **Safe fix:** Document actual auth mechanism or remove placeholder.

## 5) Fix Plan

**Phase 1 — Make it safe to deploy**
- Add auth/authz middleware and resource ownership checks.
- Add CSRF protections or disable credentialed CORS for API routes.
- Fix OpenAI JSON response format for array outputs.

**Phase 2 — Correctness & validation**
- Enforce strict request validation for plan generation and scene updates.
- Normalize durations and validate IDs everywhere.

**Phase 3 — Reliability & resilience**
- Persist queue state and rehydrate on restart.
- Fix queue cancellation to avoid stalling.
- Make log writes atomic.

**Phase 4 — Performance & polish**
- Add DB indexes for common filters.
- Align docs with engine requirements and remove placeholders.

## 6) Change Log

- Added `AUDIT_REPORT.md` (this report).

## 7) Unknowns / Questions

- **Dependency vulnerabilities:** `npm audit` not run here; run it to verify.
- **E2E coverage:** `npm run test:e2e` and render tests were not run here.
- **Production environment:** No verification of Railway/Cloud config, secrets rotation, or monitoring hooks.
- **Scaling behavior:** Multi-instance behavior is untested; current in-memory queue is not horizontally safe.

