# GitHub Issues from Audit Report

Generated from comprehensive audit conducted on January 30, 2026.

---

## Issue 1: E2E Tests Fail with webServer Timeout

**Priority:** P1 (High)  
**Labels:** `bug`, `testing`, `ci`

**Description:**
Playwright E2E tests fail with webServer timeout when running `npm run test:e2e`. The webServer configuration in `playwright.config.mjs` times out after 120 seconds waiting for the health endpoint.

**Evidence:**
- File: `playwright.config.mjs` line 20
- File: `scripts/e2e-server.mjs`
- Error: `Timed out waiting 120000ms from config.webServer`

**Impact:**
- E2E tests cannot run in CI automatically
- Developers must manually start dev server before running E2E tests
- Workaround exists but impacts DX

**Root Cause:**
Database migrations are present in e2e-server.mjs, but there may be a timing issue with health check endpoint readiness or server startup sequence.

**Acceptance Criteria:**
- [ ] `npm run test:e2e` runs without manual intervention
- [ ] All 6 E2E test specs pass
- [ ] CI job `e2e` completes successfully
- [ ] No timeout errors in Playwright output

**Verification:**
```bash
npm run test:e2e
# Should complete without timeout
```

---

## Issue 2: Upgrade Dev Dependencies with Security Vulnerabilities

**Priority:** P2 (Medium)  
**Labels:** `security`, `dependencies`, `maintenance`

**Description:**
5 moderate severity vulnerabilities detected in dev dependencies by `npm audit`. These affect esbuild, vite, and vitest packages used in development.

**Evidence:**
- Package: `esbuild` <=0.24.2 (GHSA-67mh-4wv8-2f99)
- Package: `vite` 0.11.0 - 6.1.6 (via esbuild)
- Package: `vitest` 0.0.1 - 3.0.0-beta.4 (via vite/vite-node/@vitest/mocker)
- Command: `npm audit` shows 5 moderate vulnerabilities

**Impact:**
- Security risk in development environment
- Dev server vulnerable to unauthorized requests
- Not in production bundle (dev dependencies only)

**Root Cause:**
Outdated versions of vite and vitest with known vulnerabilities.

**Acceptance Criteria:**
- [ ] Upgrade vite to 7.x (latest stable)
- [ ] Upgrade vitest to 4.x (latest stable)
- [ ] All tests still pass after upgrade
- [ ] Build succeeds with new versions
- [ ] `npm audit` shows 0 moderate/high/critical vulnerabilities

**Verification:**
```bash
npm install --save-dev vite@^7.0.0 vitest@^4.0.0
npm run test
npm run test:render
npm run build
npm audit
```

**Notes:**
Breaking changes expected - review migration guides for vite 7 and vitest 4.

---

## Issue 3: Add Unit Tests for captionsBuilder Service

**Priority:** P2 (Medium)  
**Labels:** `testing`, `enhancement`, `coverage`

**Description:**
The `captionsBuilder` service lacks unit tests. It handles critical caption generation functionality (ASS subtitle formatting, word grouping, timestamp conversion) but has no test coverage.

**Evidence:**
- File: `apps/server/src/services/captions/captionsBuilder.ts`
- No corresponding test file in `apps/server/tests/`
- Test coverage gaps identified in audit

**Impact:**
- Reduced confidence in caption generation correctness
- Hard to refactor without breaking functionality
- No regression protection for word-level timing

**Acceptance Criteria:**
- [ ] Create `apps/server/tests/captionsBuilder.unit.test.ts`
- [ ] Test ASS subtitle format generation
- [ ] Test word grouping logic (pauses, max words per segment)
- [ ] Test timestamp conversion (seconds to HH:MM:SS.mm)
- [ ] Test highlight color generation
- [ ] Test fallback mode (scene timing instead of word timing)
- [ ] All tests pass with existing implementation
- [ ] Coverage report shows captionsBuilder at 80%+

**Verification:**
```bash
npm run test -- captionsBuilder.unit.test.ts
npm run test:coverage
```

---

## Issue 4: Add Unit Tests for planGenerator Service

**Priority:** P2 (Medium)  
**Labels:** `testing`, `enhancement`, `coverage`

**Description:**
The `planGenerator` service has integration tests but no unit tests. Core template rendering, scene count calculation, and duration estimation lack isolated test coverage.

**Evidence:**
- File: `apps/server/src/services/plan/planGenerator.ts`
- Only integration tests exist in `tests/api.integration.test.ts`
- Complex logic for niche pack templates, pacing rules, and scene generation

**Impact:**
- Difficult to test edge cases in isolation
- Slow test feedback (integration tests are slower)
- Hard to identify root cause when generation fails

**Acceptance Criteria:**
- [ ] Create `apps/server/tests/planGenerator.unit.test.ts`
- [ ] Test template rendering with mock niche packs
- [ ] Test scene count calculation based on target length
- [ ] Test duration estimation (WPM, scene timing)
- [ ] Test hook generation (5 options per plan)
- [ ] Test scene distribution logic
- [ ] Mock OpenAI calls in unit tests
- [ ] All tests pass
- [ ] Coverage report shows planGenerator at 80%+

**Verification:**
```bash
npm run test -- planGenerator.unit.test.ts
npm run test:coverage
```

---

## Issue 5: Add Integration Tests for /api/automate and /api/batch Endpoints

**Priority:** P2 (Medium)  
**Labels:** `testing`, `api`, `enhancement`

**Description:**
The `/api/automate` and `/api/batch` endpoints are implemented but not tested in the integration test suite. These are critical endpoints for one-click video generation.

**Evidence:**
- File: `apps/server/src/routes/automate.ts` (implemented)
- File: `apps/server/src/routes/batch.ts` (implemented)
- File: `apps/server/tests/api.integration.test.ts` (no tests for these endpoints)

**Impact:**
- No automated verification of automate/batch flows
- Risk of regression when making changes
- Missing validation of error handling

**Acceptance Criteria:**
- [ ] Add test: POST /api/automate with valid payload returns projectId, planVersionId, runId
- [ ] Add test: POST /api/automate validates required fields
- [ ] Add test: POST /api/automate checks OpenAI/FFmpeg availability
- [ ] Add test: POST /api/batch with multiple topics creates N runs
- [ ] Add test: POST /api/batch fails fast on validation error
- [ ] Add test: Both endpoints respect APP_TEST_MODE
- [ ] All integration tests pass

**Verification:**
```bash
npm run test -- api.integration.test.ts
```

---

## Issue 6: Replace console.log Statements with Structured Logger

**Priority:** P3 (Low)  
**Labels:** `code-quality`, `observability`, `refactoring`

**Description:**
32 instances of `console.log`, `console.warn`, and `console.error` throughout the backend codebase. Should use structured logger (`logInfo`, `logWarn`, `logError`) for consistency and better observability.

**Evidence:**
- Command: `grep -rn "console\\." apps/server/src --include="*.ts" | wc -l` returns 32
- Files affected include route handlers, services, and utilities
- Logger utility exists at `apps/server/src/utils/logger.ts`

**Impact:**
- Inconsistent logging format
- Missing structured data in logs
- Harder to parse logs in production

**Acceptance Criteria:**
- [ ] Replace all `console.log` with `logInfo`
- [ ] Replace all `console.warn` with `logWarn`
- [ ] Replace all `console.error` with `logError`
- [ ] Add context objects to log calls where appropriate
- [ ] No console.* calls remain (except in test files)
- [ ] All tests still pass

**Verification:**
```bash
grep -rn "console\." apps/server/src --include="*.ts"
# Should return 0 results (exclude test files)
npm run test
```

---

## Issue 7: Consolidate Direct process.env Usage to env.ts

**Priority:** P3 (Low)  
**Labels:** `code-quality`, `refactoring`, `configuration`

**Description:**
7 locations in the backend bypass the centralized `env.ts` configuration by directly accessing `process.env`. This reduces consistency and makes env var management harder.

**Evidence:**
- File: `apps/server/src/utils/logger.ts` line 4
- File: `apps/server/src/index.ts` lines 65, 211
- File: `apps/server/src/routes/test.ts` lines 29-30, 60, 64

**Impact:**
- Inconsistent environment variable access pattern
- Harder to add validation or defaults
- Missing from centralized config

**Acceptance Criteria:**
- [ ] Move `LOG_LEVEL` to env.ts
- [ ] Move `ALLOWED_ORIGINS` parsing to env.ts
- [ ] Move `NODE_ENV` checks to env.ts helpers
- [ ] Update test.ts to use env.ts exports
- [ ] All direct process.env usage goes through env.ts
- [ ] All tests pass
- [ ] Application behavior unchanged

**Verification:**
```bash
grep -rn "process.env" apps/server/src --include="*.ts" | grep -v "env.ts"
# Should only show test.ts lines that are intentionally dynamic
npm run test
```

---

## Issue 8: Fix Mixed Language in UI (PL/EN Inconsistency)

**Priority:** P3 (Low)  
**Labels:** `ui`, `i18n`, `bug`

**Description:**
UI has mixed Polish and English text. Most labels are in English, but "Ostrzeżenia" (Warnings) appears in Polish in PlanStudio.

**Evidence:**
- File: `apps/web/src/pages/PlanStudio.tsx` line 58
- Label: "Ostrzeżenia" should be "Warnings"

**Impact:**
- Inconsistent user experience
- Confusing for non-Polish speakers
- Breaks UI language consistency

**Acceptance Criteria:**
- [ ] Change "Ostrzeżenia" to "Warnings" in PlanStudio.tsx
- [ ] Search for other Polish text in UI
- [ ] All UI labels in English (or add proper i18n)
- [ ] UI displays correctly

**Verification:**
- View PlanStudio page with validation warnings
- Verify "Warnings" label displays correctly

---

## Issue 9: Add Dockerfile for Production Deployment

**Priority:** P3 (Low)  
**Labels:** `devops`, `docker`, `enhancement`

**Description:**
No Dockerfile exists for containerized deployment. This makes it harder to deploy to cloud platforms or run in Docker environments.

**Evidence:**
- No `Dockerfile` in repository root
- No Docker-related files except `.dockerignore` (if exists)

**Impact:**
- Manual deployment process
- Inconsistent environments between dev and prod
- Cannot use container orchestration (K8s, ECS, etc.)

**Acceptance Criteria:**
- [ ] Create `Dockerfile` with multi-stage build
- [ ] Stage 1: Build frontend and backend
- [ ] Stage 2: Production runtime with only necessary files
- [ ] Expose port 3001
- [ ] Include healthcheck
- [ ] Run migrations on startup
- [ ] Image builds successfully
- [ ] Container runs and responds to health check

**Verification:**
```bash
docker build -t tiktok-ai-agent .
docker run -p 3001:3001 -e OPENAI_API_KEY=test tiktok-ai-agent
curl http://localhost:3001/api/health
```

---

## Issue 10: Add docker-compose.yml for Local Development

**Priority:** P3 (Low)  
**Labels:** `devops`, `docker`, `enhancement`

**Description:**
No `docker-compose.yml` exists for easy local Docker setup. This would simplify onboarding and provide consistent development environment.

**Evidence:**
- No `docker-compose.yml` in repository root

**Impact:**
- Manual setup required for Docker users
- Harder to reproduce production-like environment locally

**Acceptance Criteria:**
- [ ] Create `docker-compose.yml`
- [ ] Define `app` service with Dockerfile
- [ ] Mount volumes for artifacts and database
- [ ] Expose ports 3001 (backend) and 5173 (frontend)
- [ ] Include environment variables
- [ ] Add optional PostgreSQL service (commented out by default)
- [ ] `docker-compose up` starts application successfully

**Verification:**
```bash
docker-compose up
curl http://localhost:3001/api/health
curl http://localhost:5173
```

---

## Issue 11: Add Graceful Shutdown Handler

**Priority:** P3 (Low)  
**Labels:** `reliability`, `production`, `enhancement`

**Description:**
Application doesn't handle SIGTERM/SIGINT signals for graceful shutdown. This can lead to data loss or incomplete renders when server stops.

**Evidence:**
- File: `apps/server/src/index.ts` (no shutdown handler)
- No cleanup on process termination

**Impact:**
- Active renders may be lost on restart
- SSE connections not drained properly
- Database connections not closed cleanly
- In Kubernetes/cloud environments, pods may be forcefully killed

**Acceptance Criteria:**
- [ ] Add SIGTERM handler in index.ts
- [ ] Add SIGINT handler (Ctrl+C)
- [ ] Stop accepting new connections
- [ ] Cancel active renders (or wait with timeout)
- [ ] Drain SSE connections
- [ ] Close database connection
- [ ] Graceful shutdown within 30 seconds
- [ ] Log shutdown steps

**Verification:**
```bash
npm run dev
# In another terminal:
kill -TERM <pid>
# Check logs show graceful shutdown
```

---

## Issue 12: Connect Channel Presets to UI

**Priority:** P3 (Low)  
**Labels:** `feature`, `ui`, `enhancement`

**Description:**
Channel presets endpoint is implemented but not exposed in the UI. Users cannot select from predefined channel configurations when creating projects.

**Evidence:**
- Backend: `apps/server/src/routes/channelPresets.ts` (implemented)
- Frontend: No UI component for preset selection
- Missing from QuickCreate.tsx

**Impact:**
- Feature exists but hidden from users
- Users must manually configure settings that could be preset

**Acceptance Criteria:**
- [ ] Add preset selector dropdown to QuickCreate.tsx
- [ ] Fetch presets from `/api/channel-presets`
- [ ] Apply preset values when selected (voicePreset, tempo, etc.)
- [ ] UI shows preset name and description
- [ ] Selected preset populates form fields
- [ ] Form can still be manually edited after preset selection

**Verification:**
- Open QuickCreate page
- See channel preset dropdown
- Select a preset
- Verify form fields populate
- Create project with preset values

---

## Issue 13: Connect Script Templates to UI

**Priority:** P3 (Low)  
**Labels:** `feature`, `ui`, `enhancement`

**Description:**
Script templates endpoint is implemented and used in automate/batch endpoints, but not exposed in the QuickCreate UI for manual project creation.

**Evidence:**
- Backend: `apps/server/src/routes/scriptTemplates.ts` (implemented)
- Backend: Used in automate/batch endpoints with `scriptTemplateId` parameter
- Frontend: No UI component for template selection in QuickCreate

**Impact:**
- Users cannot benefit from script templates when creating projects manually
- Template feature only available via API

**Acceptance Criteria:**
- [ ] Add template selector to QuickCreate.tsx
- [ ] Fetch templates from `/api/script-templates`
- [ ] Optional field (can be left blank)
- [ ] Display template name and description
- [ ] Pass `scriptTemplateId` to plan generation
- [ ] UI shows when template was used

**Verification:**
- Open QuickCreate page
- See script template dropdown (optional)
- Select a template
- Generate plan
- Verify plan follows template structure

---

## Issue 14: Connect Topic Suggestions to UI

**Priority:** P3 (Low)  
**Labels:** `feature`, `ui`, `enhancement`

**Description:**
Topic suggestions endpoint is implemented with sample topics, but not exposed in the UI. Users cannot see topic suggestions to help them start.

**Evidence:**
- Backend: `apps/server/src/routes/topicSuggestions.ts` (implemented)
- Frontend: No "Suggest topics" button or dropdown in QuickCreate

**Impact:**
- Users may struggle with writer's block
- Useful feature hidden from users

**Acceptance Criteria:**
- [ ] Add "Suggest Topics" button to QuickCreate.tsx
- [ ] Fetch suggestions from `/api/topic-suggestions`
- [ ] Display suggestions as clickable chips or list
- [ ] Clicking suggestion populates topic field
- [ ] Filter suggestions by niche pack if selected
- [ ] UI is unobtrusive and helpful

**Verification:**
- Open QuickCreate page
- Click "Suggest Topics"
- See list of suggestions
- Click a suggestion
- Verify topic field populates

---

## Summary

**Total Issues:** 14  
**Priority Breakdown:**
- P1 (High): 1 issue
- P2 (Medium): 4 issues  
- P3 (Low): 9 issues

**Category Breakdown:**
- Testing: 4 issues
- Security: 1 issue
- Code Quality: 2 issues
- UI/Features: 4 issues
- DevOps: 3 issues

**Notes:**
- No P0 (blocker) issues - application is 100% functional
- Most issues are enhancements or technical debt
- All issues have clear acceptance criteria and verification steps
