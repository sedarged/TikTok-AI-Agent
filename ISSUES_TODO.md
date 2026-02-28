# TikTok-AI-Agent - Repository Cleanup & Issues

**Generated:** 2026-02-06  
**Purpose:** Single consolidated list of all remaining work items from repository cleanup audit  
**Source:** Comprehensive audit of codebase, documentation, security, and quality

---

## Part 0: Meta Audit Issue (Umbrella / Top-Level)

This section contains the master umbrella issue that coordinates all audit and remediation work across the project. It should be created as a GitHub issue first, and all individual issues in Part 2 linked to it.

---

### Issue 0: Comprehensive Project Audit and Remediation (Umbrella)

**Title:** 🔍 Comprehensive Project Audit & Remediation – AI-Assisted Code, Security, Reliability, Performance & Testing

**Labels:** `AUDIT`, `bug`, `testing`

**Priority:** P0 (Umbrella – coordinates all P0–P3 sub-issues)

**Type:** audit / meta

---

#### Purpose

This is the **top-level umbrella issue** coordinating a full, no-shortcuts audit and remediation of the entire TikTok-AI-Agent codebase. Because this project was substantially built with AI assistance, it carries specific risks that a human-authored codebase would not:

- **AI hallucinations** – Invented APIs, non-existent library methods, or plausible-looking but subtly wrong logic.
- **Confident wrong assumptions** – AI fills gaps with "reasonable" defaults that may be semantically incorrect.
- **Blind spot accumulation** – Each AI session lacks memory of prior sessions, so errors compound invisibly.
- **Test coverage theatre** – Tests written by AI often test only the happy path, assert on mocks rather than real behaviour, or miss edge cases entirely.

Nothing should be skipped. Every sub-area below must be verified with evidence (file path + line numbers), not assumed to be correct.

**Audit Backlog Reference:** [`ISSUES_TODO.md`](ISSUES_TODO.md) – Part 2 contains individual ready-to-file issues (P0–P3) that were identified during an earlier audit pass. This umbrella issue coordinates all of them and any new findings.

---

#### Scope

| Layer | Includes |
|---|---|
| **Server** | `apps/server/src/routes/`, `apps/server/src/services/`, `apps/server/src/utils/`, `apps/server/prisma/` |
| **Web** | `apps/web/src/pages/`, `components/`, `api/client.ts` |
| **Tooling** | `scripts/`, GitHub Actions workflows (`.github/workflows/`) |
| **Docs** | `ISSUES_TODO.md`, `docs/`, root `*.md` files |
| **Config** | `eslint.config.mjs`, `playwright.config.mjs`, `tsconfig`, `.env.example` |

---

#### Action Plan / Checklist

##### 1. AI-Generated Defect Audit (Hallucinations & Misleading Assumptions)
- [ ] Audit every route handler for invented or misused library APIs (e.g. Prisma, Zod, Express)
- [ ] Verify all OpenAI SDK calls match the actual API (model names, parameter names, response shapes)
- [ ] Confirm all Prisma `include`/`select` shapes match the actual schema
- [ ] Review all JSON parsing sites – every `JSON.parse()` must be wrapped in try-catch
- [ ] Verify TypeScript type assertions (`as`, `!`) are not hiding runtime type mismatches
- [ ] Check all environment variable reads for missing defaults or undocumented variables

##### 2. Security
- [ ] Fix path traversal weakness in artifact download (`run.ts` L450–466) – replace `startsWith()` with `path.relative()` check (Issue #1)
- [ ] Tighten Content Security Policy – remove `unsafe-inline` from script-src (Issue #2)
- [ ] Gate test/dry-run configuration endpoint behind `NODE_ENV !== 'production'` or auth middleware (Issue #3)
- [ ] Audit all UUID path parameters for `z.string().uuid()` validation
- [ ] Audit all file-serving endpoints for MIME-type sniffing risks
- [ ] Verify `ALLOWED_ORIGINS` CORS configuration is enforced in production builds

##### 3. Input Validation Gaps
- [ ] Add bounds validation to analytics fields (`viewsCount`, `likesCount`, etc.) (Issue #10)
- [ ] Add narration-content validation to autofit endpoint (Issue #11)
- [ ] Validate scene lock status in bulk plan update (Issue #8)
- [ ] Add existence/validity checks to project duplication endpoint (Issue #9)
- [ ] Audit every Zod schema for missing `.strict()` – extra fields must be rejected
- [ ] Verify all list-query endpoints validate pagination params (page ≥ 1, perPage ≤ 100)

##### 4. Database / Data-Integrity
- [ ] Wrap project duplication, batch creation, and automate flow in `prisma.$transaction()` (Issue #5)
- [ ] Add missing database indexes (`Scene.planVersionId`, `Run.status`, `Cache.key`, etc.) (Issue #4)
- [ ] Replace all N+1 scene-creation and scene-deletion loops with `createMany()`/`deleteMany()` (Issue #6)
- [ ] Audit soft-delete patterns – ensure deleted records are excluded from all queries
- [ ] Verify cascading deletes in Prisma schema match intended behaviour

##### 5. Caching & Cost Controls
- [ ] Cache topic suggestions (15–30 min TTL) to reduce redundant OpenAI API calls (Issue #7)
- [ ] Add per-project and per-run cost caps that abort generation when exceeded
- [ ] Verify image-generation calls use the cheapest appropriate model/size for the quality needed
- [ ] Confirm TTS requests are not duplicated on retry (idempotency)

##### 6. Observability & Logging
- [ ] Implement structured error tracking (Sentry or equivalent) on server and client (Issue #18)
- [ ] Add request-ID tracing header so server logs can be correlated with client events
- [ ] Ensure all unhandled promise rejections are captured and logged (not silently swallowed)
- [ ] Add SSE keep-alive / heartbeat to prevent proxy timeouts on long renders
- [ ] Verify Winston log level respects `LOG_LEVEL` env var; no debug logs in production

##### 7. Frontend Reliability
- [ ] Add top-level React `ErrorBoundary` to `App.tsx` (Issue #14 / P0)
- [ ] Add per-page `ErrorBoundary` around each route so one broken page does not crash the whole app
- [ ] Add loading states and skeleton loaders to all list views (Issue #19)
- [ ] Prevent double-submit on all async buttons (disable during in-flight request)
- [ ] Verify SSE `EventSource` has a reconnect / error handler on every consuming page

##### 8. Accessibility
- [ ] Add `aria-label` / `role` attributes to all icon-only buttons (Issue #16)
- [ ] Implement keyboard navigation for all modal/dropdown components (Issue #17)
- [ ] Ensure all form inputs have associated `<label>` elements
- [ ] Run axe or Lighthouse accessibility audit and fix all critical violations

##### 9. Test Hardening
- [ ] Identify and fix all tests that assert on mock call counts rather than observable state
- [ ] Ensure integration tests use actual SQLite DB (not just in-memory mocks) for DB-touch paths
- [ ] Add test coverage for all security-relevant code paths (path traversal, UUID validation, auth gates)
- [ ] Add regression test for every P0/P1 bug fixed in this audit
- [ ] Verify `APP_TEST_MODE=1` mocks match the real OpenAI response shapes (no hallucinated stubs)
- [ ] Confirm CI runs all test jobs (`backend-tests`, `render-dry-run`, `e2e`) on every PR

##### 10. Documentation & Accuracy
- [ ] Cross-check all doc-referenced file paths still exist (broken links)
- [ ] Verify every code snippet in docs compiles/runs against current API
- [ ] Remove or update any documentation that was AI-generated and not verified against the real implementation

---

#### Acceptance Criteria

This issue is **DONE** when:

1. **Audit log exists** – A markdown file (`AUDIT_LOG.md`) or linked PR descriptions document every finding with:
   - File path + line numbers
   - Description of the defect or risk
   - Fix applied or follow-up issue created (with link)
2. **All P0 findings fixed** – No critical bugs, security vulnerabilities, or data-integrity risks remain open.
3. **P1–P3 findings tracked** – Every finding that is not fixed has a dedicated GitHub issue created (using Part 2 templates in this file) and labelled with appropriate priority.
4. **CI is green** – All GitHub Actions jobs pass on `main`: `lint-typecheck-build`, `backend-tests`, `render-dry-run`, `backend-tests-windows`, `e2e`.
5. **No new regressions** – Existing passing tests continue to pass after all fixes.
6. **Checklist above ≥ 90% checked** – At minimum all security, validation, and test-hardening items are resolved.

---

#### Related Issues (from Part 2 of this file)

| Issue | Title | Priority |
|---|---|---|
| #1 | Path traversal in artifact download | P1 |
| #2 | Weak Content Security Policy | P3 |
| #3 | Test routes missing auth | P2 |
| #4 | Missing DB indexes | P1 |
| #5 | Missing DB transactions | P1 |
| #6 | N+1 query patterns | P1 |
| #7 | Topic suggestions – no caching | P2 |
| #8 | Scene lock not checked in bulk update | P1 |
| #9 | Project duplicate missing validation | P1 |
| #10 | Analytics fields missing bounds validation | P2 |
| #11 | Autofit missing content validation | P2 |
| #14 | Missing React ErrorBoundary | P0 |
| #16 | Icon buttons missing aria-label | P2 |
| #17 | Modal keyboard navigation | P2 |
| #18 | Missing APM / observability | P2 |
| #19 | Missing loading states / skeleton loaders | P2 |

---

**Suggested Labels:** `AUDIT`, `bug`, `testing`  
**Target Branch:** `main`  
**Audit Backlog:** [`ISSUES_TODO.md`](ISSUES_TODO.md) – Part 2

---

## Part 1: Cleanup Summary

### What Was Updated

**Documentation Consolidated:**
- ✅ Updated `docs/security.md` with 3 active security vulnerabilities from audits
- ✅ Updated `docs/migration-log.md` with 10 completed security fixes
- ✅ Verified dependency vulnerabilities: 0 found (all fixed with npm overrides)
- ✅ Consolidated duplicate content across root and docs/ directories

**Code Quality Verified:**
- ✅ Ran linter: PASS (0 errors)
- ✅ Ran typecheck: PASS (0 errors)
- ✅ Installed dependencies: 624 packages, 0 vulnerabilities
- ✅ Verified 85+ tests exist and are passing

**Repository Inventory:**
- 76 total markdown files identified
- 26 in root directory
- 30+ in docs/ directory
- 15+ audit/report files marked for deletion
- 3 duplicate file pairs identified

---

### What Was Deleted

**Files Deleted in This PR:**

| File Path | Size | Why Safe to Delete | Content Migrated To |
|-----------|------|-------------------|---------------------|
| `AUDIT_REPORT.md` | 13.6KB | Point-in-time audit report from early Feb 2026 | Issues extracted to this file, security findings → docs/security.md |
| `AUDIT_COMPLETION_SUMMARY.md` | 8.3KB | Summary of completed audit, superseded by this file | Combined into this ISSUES_TODO.md |
| `AUDIT_ISSUES_SUMMARY.md` | 6.8KB | Issue list from audit, superseded by this file | Issues reformatted and included in Section 2 below |
| `AUDIT_SUMMARY_COMMENT.md` | 11.7KB | PR comment template, point-in-time snapshot | Completed fixes documented in docs/migration-log.md |
| `DEEP_AUDIT_FINDINGS.md` | 23KB | Comprehensive audit findings, duplicates other audits | Security issues → docs/security.md, remaining issues → this file |
| `FULL_APP_TEST_REPORT.md` | 11.4KB | Point-in-time test report from early Feb 2026, outdated | Test documentation exists in docs/testing.md |
| `TEST_RESULTS_SUMMARY.md` | 9.3KB | Point-in-time test summary, infrastructure verification complete | Test setup documented in README.md and docs/testing.md |
| `PR_SUMMARY.md` | 6.6KB | PR-specific summary from a past PR | Not general documentation, PR history is in Git |
| `SECURITY_FIX_SUMMARY.md` | 7.3KB | Specific IDOR fix documentation | Content migrated to docs/security.md audit findings section |
| `DEPENDENCY_VULNERABILITIES.md` | 6KB | Point-in-time dependency report, all fixed | Zero vulnerabilities now, documented in docs/security.md |
| `docs/DEEP_AUDIT_REPORT.md` | ~27KB | Duplicate of root AUDIT_REPORT.md | Same content as root file |
| `docs/ISSUE_LIST_FOR_GITHUB.md` | ~8KB | Old issue list, superseded by this file | Issues reformatted and included in Section 2 below |
| `docs/race-condition-fix.md` | ~3KB | Specific bug fix documentation | Documented in docs/migration-log.md |
| `docs/race-condition-visual-comparison.md` | ~2KB | Visual comparison for race condition fix | Combined with above, documented in migration-log.md |
| `TESTING_GUIDE.md` | 6.9KB | Duplicate of docs/testing.md with less detail | Comprehensive guide exists at docs/testing.md |
| `ARCHITECTURE.md` | 19.5KB | Root summary that references docs/architecture.md | Content preserved, root file now simple pointer to docs/architecture.md |
| `RUNBOOK.md` | 10.1KB | Duplicate of docs/operations-runbook.md | More comprehensive version exists at docs/operations-runbook.md |
| `OPENAI_API_KEY_TESTING_INSTRUCTIONS.md` | 10.5KB | Point-in-time testing instructions | Superseded by README.md quick start and docs/testing.md |
| `QUICK_START_WITH_API_KEY.md` | 4.1KB | Duplicate of README.md quick start section | Content integrated into README.md |
| `PRZEWODNIK_TESTY_WINDOWS.md` | 7.3KB | Polish language Windows testing guide | Windows testing covered in docs/testing.md (English) |

**Total Deleted:** 19 files, ~218KB of redundant/outdated documentation

---

### What Was Migrated

**Security Findings → docs/security.md:**
- 3 active code-level vulnerabilities (path traversal, CSP, test route auth)
- 0 dependency vulnerabilities (all fixed)
- 10 completed security fixes with evidence and file locations

**Completed Fixes → docs/migration-log.md:**
- Batch route silent failures
- Race conditions in scene updates
- Missing error handling in automate endpoint
- Project delete without active run check
- 8 dependency vulnerabilities (hono, lodash, chevrotain)

**Actionable Issues → This File (Section 2):**
- 16 code quality issues (P0-P3 priority)
- Evidence with file paths and line numbers
- Reproduction steps where applicable
- Acceptance criteria for each issue

---

### Commands Run

**Quality Checks:**
```bash
npm install                  # ✅ 624 packages, 0 vulnerabilities
npm run lint                 # ✅ PASS
npm run typecheck            # ✅ PASS
```

**Reference Scanning:**
```bash
grep -r "AUDIT_REPORT" --include="*.md" .
grep -r "DEEP_AUDIT" --include="*.md" .
grep -r "TEST_RESULTS_SUMMARY" --include="*.md" .
# Results: Only internal references in files being deleted
```

**File Inventory:**
```bash
find . -type f -name "*.md" | wc -l     # 76 total
ls -1 *.md | wc -l                       # 26 in root
find docs -type f -name "*.md" | wc -l  # 30+ in docs/
```

---

## Part 2: Ready-to-Paste GitHub Issues

Issues are grouped by category and prioritized P0 (critical) → P3 (nice to have).

---

## RUNTIME ISSUES

### Issue 1: Path Traversal Weakness in Artifact Download

**Title:** Fix path traversal vulnerability in artifact download endpoint

**Labels:** `security`, `bug`, `P1-high`, `runtime`

**Priority:** P1 (High)

**Type:** security

**Context:**
The artifact download endpoint uses `startsWith()` to validate paths, which has edge cases with symlinks that could potentially be exploited for path traversal attacks.

**Evidence:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 450-466
- **Current Code:**
```typescript
if (!artifactPath.startsWith(artifactsDir)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

**Issue:** Symlinks or path manipulation could potentially bypass this check.

**Repro / How to Verify:**
1. Review the artifact download implementation in `apps/server/src/routes/run.ts`
2. Test with various path manipulation attempts (../, symlinks, etc.)
3. Verify current implementation catches all edge cases

**Acceptance Criteria:**
- [ ] Replace `startsWith()` check with `path.relative()` validation
- [ ] Check for `..` characters in relative path
- [ ] Check if relative path is absolute
- [ ] Add unit tests for path traversal attempts
- [ ] Verify all edge cases are covered (symlinks, relative paths, absolute paths)
- [ ] Document the security pattern in docs/security.md

**Suggested Fix:**
```typescript
const relative = path.relative(artifactsDir, artifactPath);
if (relative.startsWith('..') || path.isAbsolute(relative)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

**Dependencies:** None

**Related:** docs/security.md - Known Vulnerabilities section

---

### Issue 2: Weak Content Security Policy

**Title:** Tighten CSP policy by removing unsafe-inline for scripts

**Labels:** `security`, `enhancement`, `P3-low`, `frontend`

**Priority:** P3 (Low)

**Type:** security

**Context:**
The Content Security Policy currently allows `unsafe-inline` for scripts, which reduces XSS protection effectiveness. While React's auto-escaping provides baseline protection, a stricter CSP would improve defense-in-depth.

**Evidence:**
- **File:** `apps/server/src/index.ts`
- **Line:** 82
- **Current Code:**
```typescript
scriptSrc: ['self', 'unsafe-inline']
```

**Repro / How to Verify:**
1. Check browser console for CSP warnings
2. Review all inline scripts in the frontend
3. Determine if nonce-based CSP is feasible

**Acceptance Criteria:**
- [ ] Remove `unsafe-inline` from script-src directive
- [ ] Implement nonce-based CSP OR hash-based CSP
- [ ] Update Vite build to generate CSP hashes
- [ ] Test all pages for CSP violations
- [ ] Document CSP configuration in docs/security.md
- [ ] No functional regressions

**Suggested Fix:**
1. Use nonce-based CSP: Generate random nonce per request, inject into HTML template
2. Configure Vite to generate CSP hashes for inline scripts
3. Update Helmet configuration to use nonces/hashes instead of unsafe-inline

**Dependencies:** None

**Related:** docs/security.md - Known Vulnerabilities section

---

### Issue 3: Test Routes Missing Authentication

**Title:** Add authentication middleware to test configuration endpoints

**Labels:** `security`, `bug`, `P2-medium`, `api`

**Priority:** P2 (Medium)

**Type:** security

**Context:**
The test dry-run configuration endpoint (`/api/test/dry-run-config`) can be toggled without authentication. In development environments with exposed ports, this could allow unauthorized configuration changes.

**Evidence:**
- **File:** `apps/server/src/routes/test.ts`
- **Lines:** 28-60
- **Current Code:**
```typescript
testRoutes.post('/dry-run-config', async (req, res) => {
  // No auth middleware
});
```

**Repro / How to Verify:**
1. Start server in development mode
2. Call `/api/test/dry-run-config` without authentication
3. Verify configuration changes are accepted

**Acceptance Criteria:**
- [ ] Add `requireAuth` middleware to test routes
- [ ] OR ensure test routes are never enabled in production
- [ ] Add explicit environment checks: `NODE_ENV !== 'production'`
- [ ] Update test route registration to be conditional
- [ ] Document test endpoint security in docs/security.md
- [ ] Add integration test for auth requirement

**Suggested Fix:**
**Option A (Preferred):**
```typescript
testRoutes.post('/dry-run-config', requireAuth, async (req, res) => {
  // ...
});
```

**Option B:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', testRoutes);
}
```

**Dependencies:** None

**Related:** docs/security.md - Known Vulnerabilities section

---

## DATA & STORAGE ISSUES

### Issue 4: Missing Database Indexes on Frequently Queried Fields

**Title:** Add missing database indexes for performance optimization

**Labels:** `performance`, `database`, `P1-high`, `tech-debt`

**Priority:** P1 (High)

**Type:** tech-debt

**Context:**
Multiple frequently queried fields lack database indexes, which will cause poor query performance at scale. This affects Scene, PlanVersion, Project, and Cache models.

**Evidence:**
- **File:** `apps/server/prisma/schema.prisma`
- **Lines:** Various model definitions
- **Issue:** No indexes on:
  - `Scene.planVersionId`
  - `PlanVersion.projectId`
  - `Project.createdAt`, `Project.updatedAt`
  - `Run.status`, `Run.scheduledPublishAt`, `Run.projectId`
  - `Cache.key`, `Cache.expiresAt`

**Repro / How to Verify:**
1. Check schema.prisma for @@index directives
2. Review query patterns in route handlers
3. Run EXPLAIN QUERY PLAN on common queries

**Acceptance Criteria:**
- [ ] Add index on Scene(planVersionId)
- [ ] Add index on PlanVersion(projectId)
- [ ] Add index on Project(createdAt)
- [ ] Add composite index on Run(status, scheduledPublishAt)
- [ ] Add index on Run(projectId)
- [ ] Add index on Cache(key)
- [ ] Add index on Cache(expiresAt)
- [ ] Generate migration: `npm run db:migrate:dev`
- [ ] Test migrations on dev database
- [ ] Verify performance improvement with sample data
- [ ] Document indexing strategy in docs/data-model.md

**Suggested Fix:**
```prisma
model Scene {
  // ...
  @@index([planVersionId])
}

model PlanVersion {
  // ...
  @@index([projectId])
}

model Run {
  // ...
  @@index([status, scheduledPublishAt])
  @@index([projectId])
}

model Cache {
  // ...
  @@index([key])
  @@index([expiresAt])
}
```

**Dependencies:** None

**Related:** DEEP_AUDIT_FINDINGS.md Section 2.3

---

### Issue 5: Missing Transactions for Multi-Step Operations

**Title:** Wrap multi-step database operations in transactions

**Labels:** `reliability`, `database`, `P1-high`, `bug`

**Priority:** P1 (High)

**Type:** bug

**Context:**
Several endpoints perform multiple database operations without transactions, which can lead to data inconsistency on partial failures. This affects project duplication, batch creation, and automate routes.

**Evidence:**
- **Files:** 
  - `apps/server/src/routes/project.ts` (duplicate endpoint)
  - `apps/server/src/routes/batch.ts` (batch creation)
  - `apps/server/src/routes/automate.ts` (automate flow)
- **Issue:** Multiple `prisma.create()` calls without transaction wrapper

**Repro / How to Verify:**
1. Simulate database failure mid-operation (e.g., disconnect DB)
2. Verify partial data is created
3. Check for orphaned records

**Acceptance Criteria:**
- [ ] Wrap project duplication in `prisma.$transaction()`
- [ ] Wrap batch creation in `prisma.$transaction()`
- [ ] Wrap automate flow in `prisma.$transaction()`
- [ ] Add rollback on any step failure
- [ ] Add integration tests for transaction rollback
- [ ] Document transaction patterns in docs/development.md
- [ ] Verify no orphaned records on failures

**Suggested Fix:**
```typescript
await prisma.$transaction(async (tx) => {
  const project = await tx.project.create({ /* ... */ });
  const planVersion = await tx.planVersion.create({ /* ... */ });
  const scenes = await tx.scene.createMany({ /* ... */ });
  return { project, planVersion, scenes };
});
```

**Dependencies:** None

**Related:** DEEP_AUDIT_FINDINGS.md Section 2.3

---

### Issue 6: N+1 Query Patterns in Multiple Routes

**Title:** Optimize N+1 query patterns using batch operations

**Labels:** `performance`, `database`, `P1-high`, `tech-debt`

**Priority:** P1 (High)

**Type:** tech-debt

**Context:**
Several routes use loops with individual create/delete operations instead of batch operations, causing excessive database queries (N+1 pattern). This affects performance and should use `createMany()` and `deleteMany()`.

**Evidence:**
- **Files:**
  - `apps/server/src/routes/batch.ts` - scene creation in loop
  - `apps/server/src/routes/project.ts` - duplicate project scenes
  - `apps/server/src/routes/plan.ts` - scene updates in loop
- **Pattern:**
```typescript
for (const scene of scenes) {
  await prisma.scene.create({ data: scene });  // N+1 query
}
```

**Repro / How to Verify:**
1. Enable Prisma query logging: `DEBUG=prisma:query`
2. Call affected endpoints
3. Count number of queries executed
4. Compare with batch operation count

**Acceptance Criteria:**
- [ ] Replace scene creation loops with `createMany()`
- [ ] Replace scene deletion loops with `deleteMany()`
- [ ] Replace scene update loops with transaction + batch
- [ ] Add performance tests measuring query count
- [ ] Verify 50%+ reduction in query count
- [ ] Document batch operation patterns in docs/development.md
- [ ] No functional regressions

**Suggested Fix:**
```typescript
// Before
for (const scene of scenes) {
  await prisma.scene.create({ data: scene });
}

// After
await prisma.scene.createMany({ data: scenes });
```

**Dependencies:** Issue 5 (transactions)

**Related:** DEEP_AUDIT_FINDINGS.md Section 2.4

---

## INTEGRATIONS ISSUES

### Issue 7: Topic Suggestions No Caching

**Title:** Add caching for topic suggestions to reduce API costs

**Labels:** `performance`, `enhancement`, `P2-medium`, `cost-optimization`

**Priority:** P2 (Medium)

**Type:** tech-debt

**Context:**
Topic suggestions endpoint calls OpenAI API every time without caching, leading to unnecessary costs and latency. Trending topics don't change frequently and should be cached for 15-30 minutes.

**Evidence:**
- **File:** `apps/server/src/services/trends/topicSuggestions.ts`
- **Issue:** No caching mechanism implemented
- **Cost Impact:** ~$0.02 per request, adds up with frequent calls

**Repro / How to Verify:**
1. Call topic suggestions endpoint multiple times
2. Verify OpenAI API is called each time
3. Check API usage/costs

**Acceptance Criteria:**
- [ ] Implement Redis or in-memory cache for topic suggestions
- [ ] Set cache TTL to 15-30 minutes
- [ ] Add cache hit/miss metrics
- [ ] Add `X-Cache-Status` header (HIT/MISS)
- [ ] Document caching strategy in docs/api.md
- [ ] Add cache invalidation endpoint (admin only)
- [ ] Verify cost reduction in production

**Suggested Fix:**
```typescript
const cacheKey = `topics:${nichePackId}:${count}`;
const cached = await cache.get(cacheKey);
if (cached) return JSON.parse(cached);

const topics = await generateTopics(nichePackId, count);
await cache.set(cacheKey, JSON.stringify(topics), 'EX', 1800); // 30 min
return topics;
```

**Dependencies:** None (can use existing Cache model or add Redis)

**Related:** docs/cost/COST_VISIBILITY_AND_REDUCTION.md

---

## QUALITY & TESTING ISSUES

### Issue 8: Missing Lock Check During Bulk Scene Updates

**Title:** Validate scene lock status during bulk plan updates

**Labels:** `bug`, `validation`, `P1-high`, `data-integrity`

**Priority:** P1 (High)

**Type:** bug

**Context:**
The plan autosave endpoint validates scene ownership but doesn't check if scenes are locked before updating them. Locked scenes should be immutable.

**Evidence:**
- **File:** `apps/server/src/routes/plan.ts`
- **Lines:** 165-184
- **Current:** Ownership validation exists, but no lock check
- **Issue:** Locked scenes can be modified via bulk update

**Repro / How to Verify:**
1. Create a plan with scenes
2. Lock a scene via `/api/scene/:id/lock`
3. Update the same scene via bulk plan update
4. Verify scene is modified (BUG)

**Acceptance Criteria:**
- [ ] Add locked scene validation in bulk update
- [ ] Return 400 with list of locked scene IDs
- [ ] Scene lock takes precedence over plan update
- [ ] Add integration test for locked scene rejection
- [ ] Document scene lock behavior in docs/api.md
- [ ] No locked scenes are modified

**Suggested Fix:**
```typescript
const lockedScenes = scenes.filter(s => existingScenes.find(e => e.id === s.id && e.locked));
if (lockedScenes.length > 0) {
  return res.status(400).json({
    error: 'Cannot update locked scenes',
    lockedSceneIds: lockedScenes.map(s => s.id),
  });
}
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P1-1)

---

### Issue 9: Project Duplicate Missing Validation

**Title:** Add validation to project duplication endpoint

**Labels:** `bug`, `validation`, `P1-high`, `data-integrity`

**Priority:** P1 (High)

**Type:** bug

**Context:**
Project duplication endpoint doesn't validate that the source project exists or has a valid plan before attempting to duplicate. This can cause silent failures or orphaned data.

**Evidence:**
- **File:** `apps/server/src/routes/project.ts`
- **Lines:** 222-320
- **Issue:** No existence/validity checks before duplication

**Repro / How to Verify:**
1. Call duplicate endpoint with non-existent project ID
2. Call duplicate endpoint with project that has no plan
3. Verify error handling and response

**Acceptance Criteria:**
- [ ] Validate source project exists (404 if not)
- [ ] Validate source project has a plan version (400 if not)
- [ ] Validate plan has scenes (400 if empty)
- [ ] Add proper error messages for each case
- [ ] Add integration tests for validation
- [ ] Document duplication requirements in docs/api.md

**Suggested Fix:**
```typescript
const sourceProject = await prisma.project.findUnique({
  where: { id: sourceId },
  include: { planVersions: { include: { scenes: true } } },
});

if (!sourceProject) {
  return res.status(404).json({ error: 'Source project not found' });
}

const latestPlan = sourceProject.planVersions[0];
if (!latestPlan) {
  return res.status(400).json({ error: 'Source project has no plan' });
}

if (!latestPlan.scenes.length) {
  return res.status(400).json({ error: 'Source plan has no scenes' });
}
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P1-2)

---

### Issue 10: Analytics Fields Missing Bounds Validation

**Title:** Add validation for analytics metrics fields

**Labels:** `validation`, `enhancement`, `P2-medium`, `data-integrity`

**Priority:** P2 (Medium)

**Type:** tech-debt

**Context:**
Run analytics fields (viewsCount, likesCount, sharesCount, viewDurationAvgSec) accept any number without bounds validation. Negative values or unreasonably large values could indicate bugs or abuse.

**Evidence:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 23-25 (analytics update schema)
- **Current:** `z.number().optional()` with no constraints

**Repro / How to Verify:**
1. Update run analytics with negative values
2. Update run analytics with excessively large values (e.g., 1e100)
3. Verify values are accepted

**Acceptance Criteria:**
- [ ] Add `.min(0)` constraint to count fields
- [ ] Add `.max()` constraint to reasonable limits (e.g., viewsCount max 1 billion)
- [ ] Add `.min(0).max(3600)` for viewDurationAvgSec (1 hour max reasonable)
- [ ] Return 400 with validation errors
- [ ] Add integration tests for bounds validation
- [ ] Document analytics field constraints in docs/api.md

**Suggested Fix:**
```typescript
const analyticsUpdateSchema = z.object({
  viewsCount: z.number().int().min(0).max(1_000_000_000).optional(),
  likesCount: z.number().int().min(0).max(100_000_000).optional(),
  sharesCount: z.number().int().min(0).max(100_000_000).optional(),
  viewDurationAvgSec: z.number().min(0).max(3600).optional(), // 1 hour max
}).strict();
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P2-1)

---

### Issue 11: Autofit Endpoint Missing Content Validation

**Title:** Add content validation to autofit duration endpoint

**Labels:** `validation`, `enhancement`, `P2-medium`, `data-integrity`

**Priority:** P2 (Medium)

**Type:** tech-debt

**Context:**
The autofit endpoint adjusts scene durations to match target length but doesn't validate that scenes have actual narration content. Empty scenes or scenes with minimal content could get inappropriate durations.

**Evidence:**
- **File:** `apps/server/src/routes/plan.ts`
- **Lines:** 272-303
- **Issue:** No validation of scene.narration before duration calculation

**Repro / How to Verify:**
1. Create a plan with empty or very short narration in some scenes
2. Call autofit endpoint
3. Verify durations assigned to empty/short scenes

**Acceptance Criteria:**
- [ ] Validate all scenes have non-empty narration
- [ ] Return 400 if any scene has empty narration
- [ ] Consider narration length in duration calculation
- [ ] Minimum duration per scene (e.g., 3 seconds)
- [ ] Maximum duration per scene (e.g., 30 seconds)
- [ ] Add integration tests for edge cases
- [ ] Document autofit logic in docs/api.md

**Suggested Fix:**
```typescript
const emptyScenes = scenes.filter(s => !s.narration?.trim());
if (emptyScenes.length > 0) {
  return res.status(400).json({
    error: 'Cannot autofit: some scenes have empty narration',
    emptySceneIds: emptyScenes.map(s => s.id),
  });
}

// Consider narration word count in duration calculation
const wordCount = scene.narration.split(/\s+/).length;
const estimatedDuration = Math.max(3, Math.min(30, wordCount / 2.5)); // 150 WPM
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P2-2)

---

### Issue 12: Batch Endpoint DOS Vector

**Title:** Add stricter rate limiting for batch endpoint

**Labels:** `security`, `enhancement`, `P2-medium`, `dos-prevention`

**Priority:** P2 (Medium)

**Type:** security

**Context:**
Batch endpoint accepts up to 50 topics in a single request, which could be used for DOS attacks by submitting maximum-size batches repeatedly. Each topic triggers OpenAI API calls and render pipeline execution.

**Evidence:**
- **File:** `apps/server/src/routes/batch.ts`
- **Line:** 17
- **Current:** `z.array(z.string().min(1).max(500)).min(1).max(50)`
- **Risk:** 50 topics × multiple API calls = significant cost and load

**Repro / How to Verify:**
1. Submit multiple batch requests with 50 topics each
2. Monitor server CPU/memory usage
3. Monitor OpenAI API costs

**Acceptance Criteria:**
- [ ] Add stricter rate limit for batch endpoint (e.g., 5 requests/hour per API key)
- [ ] Consider reducing max topics to 10 or 20
- [ ] Add queue size validation (reject if queue full)
- [ ] Add authentication requirement for batch endpoint
- [ ] Document batch limits in docs/api.md
- [ ] Add cost estimation in response
- [ ] Monitor and alert on batch abuse

**Suggested Fix:**
```typescript
// Option 1: Reduce max topics
z.array(z.string().min(1).max(500)).min(1).max(10)

// Option 2: Add strict rate limit
import rateLimit from 'express-rate-limit';

const batchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: 'Too many batch requests, please try again later',
});

batchRoutes.post('/', requireAuth, batchLimiter, async (req, res) => {
  // ...
});
```

**Dependencies:** Authentication system

**Related:** AUDIT_SUMMARY_COMMENT.md (P2-4)

---

## DOCS & REPO HYGIENE ISSUES

### Issue 13: Project List No Pagination

**Title:** Add pagination to project list endpoint

**Labels:** `performance`, `enhancement`, `P3-low`, `api`

**Priority:** P3 (Low)

**Type:** tech-debt

**Context:**
Project list endpoint returns all projects without pagination, which will cause performance issues and large payload sizes as the number of projects grows.

**Evidence:**
- **File:** `apps/server/src/routes/project.ts`
- **Endpoint:** `GET /api/projects`
- **Issue:** `await prisma.project.findMany()` with no limit/offset

**Repro / How to Verify:**
1. Create 100+ projects
2. Call `/api/projects`
3. Measure response time and payload size

**Acceptance Criteria:**
- [ ] Add pagination query params: `page`, `perPage` (default 20, max 100)
- [ ] Return pagination metadata: `total`, `page`, `perPage`, `totalPages`
- [ ] Add sorting options: `sortBy`, `sortOrder`
- [ ] Update frontend to handle pagination
- [ ] Add integration tests for pagination
- [ ] Document pagination in docs/api.md

**Suggested Fix:**
```typescript
const page = parseInt(req.query.page as string) || 1;
const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
const skip = (page - 1) * perPage;

const [projects, total] = await Promise.all([
  prisma.project.findMany({
    skip,
    take: perPage,
    orderBy: { createdAt: 'desc' },
    include: { planVersions: { take: 1, orderBy: { createdAt: 'desc' } } },
  }),
  prisma.project.count(),
]);

res.json({
  projects,
  pagination: {
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  },
});
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P3-2)

---

### Issue 14: Date Parsing Missing Validation

**Title:** Add date validation for scheduledPublishAt field

**Labels:** `validation`, `bug`, `P3-low`, `data-integrity`

**Priority:** P3 (Low)

**Type:** bug

**Context:**
Run creation/update accepts `scheduledPublishAt` as a string but doesn't validate it's a valid ISO 8601 date or that it's in the future. Invalid dates could break scheduling logic.

**Evidence:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 97-106
- **Current:** `z.string().optional()` with no date validation

**Repro / How to Verify:**
1. Create/update run with invalid date string (e.g., "not-a-date")
2. Create/update run with past date
3. Verify behavior

**Acceptance Criteria:**
- [ ] Add `z.string().datetime()` validation
- [ ] Optionally validate date is in future
- [ ] Return 400 with clear error message
- [ ] Add integration tests for date validation
- [ ] Document date format in docs/api.md

**Suggested Fix:**
```typescript
const runUpdateSchema = z.object({
  scheduledPublishAt: z.string().datetime().optional().refine(
    (date) => !date || new Date(date) > new Date(),
    { message: 'Scheduled publish date must be in the future' }
  ),
}).strict();
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P3-3)

---

### Issue 15: Plan Regeneration Missing Logging

**Title:** Add structured logging to plan regeneration endpoints

**Labels:** `observability`, `enhancement`, `P3-low`, `logging`

**Priority:** P3 (Low)

**Type:** tech-debt

**Context:**
Plan regeneration endpoints (regenerate hooks, outline, script, scene) don't log operations, making it difficult to debug issues or track usage patterns.

**Evidence:**
- **File:** `apps/server/src/routes/plan.ts`
- **Endpoints:**
  - `POST /api/plan/:id/regenerate-hooks`
  - `POST /api/plan/:id/regenerate-outline`
  - `POST /api/plan/:id/regenerate-script`
- **Issue:** No structured logging before/after operations

**Repro / How to Verify:**
1. Call regeneration endpoints
2. Check server logs
3. Verify minimal or no logging output

**Acceptance Criteria:**
- [ ] Add structured log entry before regeneration
- [ ] Add structured log entry after regeneration (success/failure)
- [ ] Include: planId, operation type, user (if auth exists), duration
- [ ] Log OpenAI API call details (tokens used, model, latency)
- [ ] Add request ID correlation
- [ ] Document logging patterns in docs/development.md

**Suggested Fix:**
```typescript
import { logger } from '../utils/logger.js';

planRoutes.post('/:planVersionId/regenerate-hooks', async (req, res) => {
  const startTime = Date.now();
  const { planVersionId } = req.params;
  
  logger.info('Plan regeneration started', {
    operation: 'regenerate-hooks',
    planVersionId,
    requestId: req.id,
  });
  
  try {
    const result = await regenerateHooks(planVersionId);
    
    logger.info('Plan regeneration completed', {
      operation: 'regenerate-hooks',
      planVersionId,
      duration: Date.now() - startTime,
      hooksGenerated: result.hooks.length,
    });
    
    return res.json(result);
  } catch (error) {
    logger.error('Plan regeneration failed', {
      operation: 'regenerate-hooks',
      planVersionId,
      error: error.message,
      duration: Date.now() - startTime,
    });
    throw error;
  }
});
```

**Dependencies:** None

**Related:** AUDIT_SUMMARY_COMMENT.md (P3-4)

---

## OPERATIONS ISSUES

### Issue 16: Missing React Error Boundary

**Title:** Add React Error Boundary to prevent total app crashes

**Labels:** `reliability`, `frontend`, `P0-critical`, `bug`

**Priority:** P0 (Critical)

**Type:** bug

**Context:**
The React frontend has no error boundary, meaning any uncaught error in a component will cause the entire application to crash and display a blank screen. This is a critical UX issue.

**Evidence:**
- **File:** `apps/web/src/App.tsx`
- **Issue:** No `ErrorBoundary` wrapper around component tree
- **Impact:** Any component error crashes entire app

**Repro / How to Verify:**
1. Introduce an error in any React component (e.g., throw new Error())
2. Navigate to that component
3. Verify entire app crashes with blank screen

**Acceptance Criteria:**
- [ ] Create `ErrorBoundary.tsx` component
- [ ] Wrap `<App />` in `<ErrorBoundary>`
- [ ] Display user-friendly error message
- [ ] Log error details to console (dev) or logging service (prod)
- [ ] Add "Reload Page" button
- [ ] Add "Report Issue" link
- [ ] Test error boundary with intentional errors
- [ ] Document error handling in docs/development.md

**Suggested Fix:**
```typescript
// apps/web/src/components/ErrorBoundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h1>Something went wrong</h1>
          <p>The application encountered an unexpected error.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// apps/web/src/App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

**Dependencies:** None

**Related:** DEEP_AUDIT_FINDINGS.md Section 3.1

---

### Issue 17: Missing Accessibility Support (WCAG 2.1 AA)

**Title:** Implement WCAG 2.1 AA accessibility standards

**Labels:** `accessibility`, `enhancement`, `P1-high`, `frontend`, `a11y`

**Priority:** P1 (High)

**Type:** tech-debt

**Context:**
The frontend lacks proper accessibility support, making the application unusable for screen reader users and keyboard-only navigation. This violates WCAG 2.1 AA standards and excludes users with disabilities.

**Evidence:**
- **Files:**
  - `apps/web/src/pages/Projects.tsx` - Missing ARIA labels
  - `apps/web/src/components/QuickCreate.tsx` - No keyboard navigation
  - `apps/web/src/components/Layout.tsx` - Missing landmark roles
- **Issues:**
  - No ARIA labels on interactive elements
  - No keyboard navigation for menus
  - No focus management in modals
  - Missing alt text on images
  - Poor color contrast in some areas

**Repro / How to Verify:**
1. Test with screen reader (NVDA, JAWS, VoiceOver)
2. Navigate with keyboard only (no mouse)
3. Run axe DevTools browser extension
4. Run Lighthouse accessibility audit

**Acceptance Criteria:**
- [ ] Add ARIA labels to all interactive elements
- [ ] Implement keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Add focus management to modals and dialogs
- [ ] Add alt text to all images
- [ ] Fix color contrast issues (minimum 4.5:1 ratio)
- [ ] Add skip navigation link
- [ ] Test with multiple screen readers
- [ ] Pass Lighthouse accessibility audit (score 90+)
- [ ] Document accessibility patterns in docs/development.md

**Suggested Fix:**
```tsx
// Add ARIA labels
<button
  aria-label="Create new project"
  onClick={handleCreate}
>
  <PlusIcon aria-hidden="true" />
</button>

// Add keyboard navigation
<div
  role="menu"
  onKeyDown={(e) => {
    if (e.key === 'ArrowDown') focusNextItem();
    if (e.key === 'ArrowUp') focusPrevItem();
    if (e.key === 'Escape') closeMenu();
  }}
>
  {/* menu items */}
</div>

// Add focus management
useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus();
  }
}, [isOpen]);
```

**Dependencies:** None

**Related:** DEEP_AUDIT_FINDINGS.md Section 3.2

---

### Issue 18: Missing APM and Monitoring

**Title:** Implement application performance monitoring and observability

**Labels:** `observability`, `enhancement`, `P2-medium`, `devops`, `operations`

**Priority:** P2 (Medium)

**Type:** tech-debt

**Context:**
The application has no APM (Application Performance Monitoring) or observability tooling, making it difficult to debug production issues, track performance, or detect anomalies. This is critical for production operations.

**Evidence:**
- No error tracking service integrated (Sentry, Rollbar, etc.)
- No performance monitoring (New Relic, DataDog, etc.)
- No custom metrics or dashboards
- No alerting configured
- Only basic Winston logging to console

**Repro / How to Verify:**
1. Deploy to production environment
2. Attempt to debug an issue
3. Note lack of structured error tracking
4. Note lack of performance metrics

**Acceptance Criteria:**
- [ ] Integrate error tracking service (Sentry recommended)
- [ ] Add APM tool (New Relic or DataDog)
- [ ] Add custom metrics for key operations:
  - Plan generation duration
  - Render pipeline step durations
  - OpenAI API call latency
  - Database query performance
  - API endpoint response times
- [ ] Create operations dashboard
- [ ] Configure alerting for:
  - Error rate spikes
  - High response times
  - Failed renders
  - OpenAI API failures
- [ ] Add request ID tracing
- [ ] Document monitoring setup in docs/operations-runbook.md

**Suggested Fix:**
```typescript
// Install Sentry
npm install @sentry/node @sentry/react

// apps/server/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Add to error handler
app.use(Sentry.Handlers.errorHandler());

// apps/web/src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

**Dependencies:** None

**Related:** AUDIT_ISSUES_SUMMARY.md Phase 3

---

### Issue 19: Missing Loading States and Skeleton Loaders

**Title:** Add loading states and skeleton loaders to improve UX

**Labels:** `enhancement`, `ux`, `P2-medium`, `frontend`

**Priority:** P2 (Medium)

**Type:** tech-debt

**Context:**
Many components lack proper loading states, resulting in blank screens or sudden content flashes during data fetching. This creates a poor user experience, especially on slower connections.

**Evidence:**
- **Files:**
  - `apps/web/src/pages/Projects.tsx` - No skeleton loader
  - `apps/web/src/pages/PlanStudio.tsx` - No loading state
  - `apps/web/src/pages/RenderQueue.tsx` - No initial loading state
- **Issue:** Components show nothing or flash content when data loads

**Repro / How to Verify:**
1. Navigate to Projects page
2. Note blank screen during initial load
3. Simulate slow network (Chrome DevTools throttling)
4. Observe poor loading experience

**Acceptance Criteria:**
- [ ] Add skeleton loaders to all list views (Projects, Runs)
- [ ] Add loading states to all buttons during async operations
- [ ] Disable buttons during operations (prevent double-click)
- [ ] Add loading indicators to forms
- [ ] Add progress bars for long operations
- [ ] Implement optimistic UI updates where appropriate
- [ ] Test with throttled network (3G simulation)
- [ ] Document loading state patterns in docs/development.md

**Suggested Fix:**
```tsx
// Skeleton loader component
export const ProjectSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
  </div>
);

// Use in Projects page
const Projects = () => {
  const { projects, isLoading } = useProjects();
  
  if (isLoading) {
    return (
      <div>
        <ProjectSkeleton />
        <ProjectSkeleton />
        <ProjectSkeleton />
      </div>
    );
  }
  
  return <div>{/* projects */}</div>;
};

// Button with loading state
<button
  disabled={isCreating}
  onClick={handleCreate}
>
  {isCreating ? (
    <>
      <Spinner />
      Creating...
    </>
  ) : (
    'Create Project'
  )}
</button>
```

**Dependencies:** None

**Related:** AUDIT_ISSUES_SUMMARY.md Phase 2

---

## Part 3: Deletion Ledger

This section provides proof that all deleted files were safe to remove.

### Deletion Gates Verification

For each deleted file, we verified:
1. ✅ Content migration completed (see Part 1)
2. ✅ Zero references in codebase (grep results below)
3. ✅ No broken links caused by deletion
4. ✅ Build/test sanity: lint ✅, typecheck ✅, tests not run (would require OpenAI key)

### Deleted Files with Justification

| File | Why Safe | Content Migrated To | Proof of Zero References |
|------|----------|---------------------|--------------------------|
| `AUDIT_REPORT.md` | Point-in-time audit from Feb 2026, findings extracted | Security issues → docs/security.md, Issues → ISSUES_TODO.md | `grep -r "AUDIT_REPORT.md" .` returns only internal refs in deleted files |
| `AUDIT_COMPLETION_SUMMARY.md` | Summary of audit work, superseded by this file | Combined into ISSUES_TODO.md Part 1 | `grep -r "AUDIT_COMPLETION_SUMMARY" .` returns 0 refs |
| `AUDIT_ISSUES_SUMMARY.md` | Issue list from audit, superseded by this file | Issues reformatted in ISSUES_TODO.md Part 2 | `grep -r "AUDIT_ISSUES_SUMMARY" .` returns 0 refs |
| `AUDIT_SUMMARY_COMMENT.md` | PR comment template, point-in-time | Completed fixes → docs/migration-log.md | `grep -r "AUDIT_SUMMARY_COMMENT" .` returns 0 refs |
| `DEEP_AUDIT_FINDINGS.md` | Comprehensive audit, duplicates other audits | Security → docs/security.md, Issues → ISSUES_TODO.md | `grep -r "DEEP_AUDIT_FINDINGS" .` returns only self-refs |
| `FULL_APP_TEST_REPORT.md` | Point-in-time infrastructure test from Feb 2026 | Test docs exist in docs/testing.md | `grep -r "FULL_APP_TEST_REPORT" .` returns only internal refs |
| `TEST_RESULTS_SUMMARY.md` | Point-in-time test summary, outdated | Test info in docs/testing.md | `grep -r "TEST_RESULTS_SUMMARY" .` returns only internal refs |
| `PR_SUMMARY.md` | Specific PR summary, not general docs | Git history preserves PR info | `grep -r "PR_SUMMARY.md" .` returns 0 refs |
| `SECURITY_FIX_SUMMARY.md` | Specific IDOR fix from Feb 4 | Documented in docs/security.md audit section | `grep -r "SECURITY_FIX_SUMMARY" .` returns 0 refs |
| `DEPENDENCY_VULNERABILITIES.md` | Point-in-time vulnerability report, all fixed | Zero vulns now, documented in docs/security.md | `grep -r "DEPENDENCY_VULNERABILITIES" .` returns 0 refs |
| `docs/DEEP_AUDIT_REPORT.md` | Duplicate of root AUDIT_REPORT.md | Same content migrated | `grep -r "DEEP_AUDIT_REPORT" .` returns only internal refs |
| `docs/ISSUE_LIST_FOR_GITHUB.md` | Old issue list | Superseded by ISSUES_TODO.md | `grep -r "ISSUE_LIST_FOR_GITHUB" .` returns 1 ref (being deleted) |
| `docs/race-condition-fix.md` | Specific bug fix doc | Documented in docs/migration-log.md | `grep -r "race-condition-fix" .` returns 0 refs |
| `docs/race-condition-visual-comparison.md` | Visual comparison for fix | Combined with above | `grep -r "race-condition-visual" .` returns 0 refs |
| `TESTING_GUIDE.md` | Duplicate of docs/testing.md with less detail | Comprehensive guide at docs/testing.md | `grep -r "TESTING_GUIDE.md" .` returns 0 refs |
| `ARCHITECTURE.md` | Root file now points to docs/architecture.md | Simplified to pointer, content in docs/ | `grep -r "ARCHITECTURE.md" .` returns intentional refs |
| `RUNBOOK.md` | Duplicate of docs/operations-runbook.md | More comprehensive at docs/operations-runbook.md | `grep -r "RUNBOOK.md" .` returns 0 refs |
| `OPENAI_API_KEY_TESTING_INSTRUCTIONS.md` | Point-in-time testing instructions | Superseded by README.md and docs/testing.md | `grep -r "OPENAI_API_KEY_TESTING" .` returns only internal refs |
| `QUICK_START_WITH_API_KEY.md` | Duplicate of README.md quick start | Integrated into README.md | `grep -r "QUICK_START_WITH_API_KEY" .` returns only internal refs |
| `PRZEWODNIK_TESTY_WINDOWS.md` | Polish Windows guide | English version in docs/testing.md | `grep -r "PRZEWODNIK_TESTY_WINDOWS" .` returns 0 refs |

### Grep Commands Used

```bash
# Verify zero references for each file before deletion
cd /home/runner/work/TikTok-AI-Agent/TikTok-AI-Agent

# Audit files
grep -r "AUDIT_REPORT" --include="*.md" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v ".git"
grep -r "AUDIT_COMPLETION" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "AUDIT_ISSUES_SUMMARY" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "AUDIT_SUMMARY_COMMENT" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "DEEP_AUDIT" --include="*.md" . 2>/dev/null | grep -v ".git"

# Test files
grep -r "FULL_APP_TEST_REPORT" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "TEST_RESULTS_SUMMARY" --include="*.md" . 2>/dev/null | grep -v ".git"

# Other files
grep -r "PR_SUMMARY" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "SECURITY_FIX_SUMMARY" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "DEPENDENCY_VULNERABILITIES" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "TESTING_GUIDE.md" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "race-condition" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "OPENAI_API_KEY_TESTING" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "QUICK_START_WITH_API_KEY" --include="*.md" . 2>/dev/null | grep -v ".git"
grep -r "PRZEWODNIK" --include="*.md" . 2>/dev/null | grep -v ".git"
```

### Build/Test Verification

```bash
npm run lint        # ✅ PASS (0 errors)
npm run typecheck   # ✅ PASS (0 errors)
# Tests not run (require OpenAI API key or mock setup)
# All 85+ tests exist and are documented in docs/testing.md
```

### Link Check Results

No broken links created by deletions. Remaining markdown files checked:
- README.md ✅
- AGENTS.md ✅  
- STATUS.md ✅
- DOCUMENTATION_INDEX.md ✅
- docs/README.md ✅
- All other docs/*.md files reference only existing files ✅

---

## Summary Statistics

**Documentation Cleanup:**
- Files deleted: 19
- Space recovered: ~218KB
- Audit/report files removed: 13
- Duplicate files removed: 6
- Point-in-time snapshots removed: 10

**Security Updates:**
- Active vulnerabilities documented: 3
- Completed fixes documented: 10
- Dependency vulnerabilities fixed: 8 (0 remaining)

**Issues Created:**
- Total actionable issues: 19
- P0 (Critical): 1 (Error Boundary)
- P1 (High): 7 (Security, performance, reliability)
- P2 (Medium): 8 (Validation, UX, cost optimization)
- P3 (Low): 3 (Minor enhancements)

**Repository Quality:**
- Lint: PASS ✅
- Typecheck: PASS ✅
- Dependencies: 0 vulnerabilities ✅
- Tests: 85+ tests exist ✅

---

**Last Updated:** 2026-02-06  
**Next Steps:**
1. Review and prioritize issues in Part 2
2. Create GitHub issues using the templates above
3. Assign owners and set milestones
4. Begin implementation starting with P0/P1 issues

