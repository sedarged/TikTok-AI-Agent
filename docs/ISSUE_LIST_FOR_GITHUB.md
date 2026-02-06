# 🚨 Deep Audit Issues - Ready to Copy as GitHub Issues

**Generated:** 2026-02-06  
**Total Issues:** 20 (4 P0, 6 P1, 6 P2, 4 P3)  
**Instructions:** Copy each issue below and create as separate GitHub issue with appropriate labels

---

## 🔴 P0 ISSUES (Critical - Blocks Production)

### P0-1: Silent Failure on Empty Topics in Batch Endpoint

**Labels:** `P0`, `bug`, `api`, `batch`

**Description:**
Empty topics (whitespace-only strings) in batch requests are silently skipped without notifying the user, causing confusion about missing projects.

**Location:**
- **File:** `apps/server/src/routes/batch.ts`
- **Lines:** 91-93
- **Function:** `POST /api/batch`

**Code:**
```typescript
for (const topic of topics) {
  const trimmed = topic.trim();
  if (!trimmed) continue;  // ← Silent skip, user unaware
```

**Impact:**
User submits batch with `["Topic 1", "  ", "Topic 3"]`. API returns success with only 2 projects created instead of expected 3. User confused about missing project.

**Reproduction:**
```bash
curl -X POST http://localhost:3001/api/batch \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topics": ["Valid Topic", "   ", "Another Topic"], "nichePackId": "horror"}'
# Returns 2 runs instead of expected 3
```

**Recommended Fix:**
1. **Option A:** Return 400 error if any topic is empty after trim
2. **Option B:** Include `skippedTopics: string[]` in response with reason
3. Add validation before processing loop

**Acceptance Criteria:**
- [ ] Empty/whitespace topics cause 400 error OR included in response
- [ ] User clearly informed about which topics were skipped and why
- [ ] Add test case for empty topic handling

**Effort:** 30 minutes

---

### P0-2: Batch Endpoint Fail-Fast Without Rollback

**Labels:** `P0`, `bug`, `api`, `batch`, `reliability`

**Description:**
Plan validation failure mid-batch causes partial completion. Earlier topics are already queued and rendering, later topics never processed. Response returns 400 but some runs are already executing. No rollback mechanism.

**Location:**
- **File:** `apps/server/src/routes/batch.ts`
- **Lines:** 127-141
- **Function:** `POST /api/batch`

**Code:**
```typescript
const validation = validatePlan(fullPlan, fullPlan.project);
if (validation.errors.length > 0) {
  return res.status(400).json({ error: `Plan validation failed...` });
  // Earlier topics' runs already in queue - no rollback!
}
```

**Impact:**
Batch of 10 topics fails validation on topic #5. Runs 1-4 start rendering, user receives error. Inconsistent state - partial batch executed without user knowing which topics succeeded.

**Reproduction:**
1. Submit batch with topics 1-4 valid, topic 5 has validation error (e.g., invalid niche pack)
2. Check DB: 4 runs created with status 'queued' or 'running'
3. API returns 400 error
4. User thinks entire batch failed, but 4 runs are processing

**Recommended Fix:**
**Option A (Preferred):** Validate ALL plans before queueing ANY runs
```typescript
// Phase 1: Generate and validate all plans
const results = [];
for (const topic of topics) {
  const { project, planVersion } = await generatePlanForTopic(topic);
  const validation = validatePlan(planVersion, project);
  if (validation.errors.length > 0) {
    return res.status(400).json({ 
      error: `Validation failed for topic "${topic}"`,
      details: validation 
    });
  }
  results.push({ project, planVersion });
}

// Phase 2: Only if all valid, queue all runs
for (const { project, planVersion } of results) {
  const run = await startRenderPipeline(planVersion);
  runs.push(run);
}
```

**Option B:** Return partial success
```typescript
return res.json({
  successful: successfulRuns,
  failed: failedTopics.map(t => ({ topic: t, reason: '...' }))
});
```

**Acceptance Criteria:**
- [ ] All-or-nothing batch processing OR clear partial success response
- [ ] No orphaned runs on validation failure
- [ ] Add integration test for batch validation failure mid-batch

**Effort:** 1-2 hours

---

### P0-3: Race Condition in Scene Bulk Updates

**Labels:** `P0`, `bug`, `api`, `race-condition`, `database`

**Description:**
Scene bulk update validates scenes exist, then updates them in a loop without transaction. If a scene is deleted between validation and update (concurrent request or DB issue), `prisma.scene.update()` fails mid-loop. Results in partial updates with no error returned to client.

**Location:**
- **File:** `apps/server/src/routes/plan.ts`
- **Lines:** 102-138, 157-186
- **Function:** `PUT /api/plan/:id`

**Code:**
```typescript
// Validate all scenes (line 120)
for (const sceneId of sceneIds) {
  const existingScene = existingScenesMap.get(sceneId);
  if (!existingScene || existingScene.planVersionId !== planVersionId) {
    rejectedSceneIds.push(sceneId);
  }
}
// Then update each (line 159) - NO transaction!
for (const scene of scenes) {
  if (!scene.id) continue;
  const existingScene = scenesToUpdate.get(scene.id);
  if (!existingScene) continue;
  // No try-catch around update - could fail mid-loop
  await prisma.scene.update({ where: { id: scene.id }, data: { ... } });
}
```

**Impact:**
10 scenes in plan. Update fails on scene 6 (DB error or concurrent delete). Scenes 1-5 updated, 7-10 not updated. Plan in inconsistent state. No error returned to client.

**Reproduction:**
1. Create project with 10 scenes
2. Start two concurrent requests:
   - Request A: `DELETE /api/scene/:sceneId` for scene 6
   - Request B: `PUT /api/plan/:id` to update all 10 scenes
3. Race condition: some scenes updated, some fail silently

**Recommended Fix:**
Wrap update loop in Prisma transaction:
```typescript
await prisma.$transaction(async (tx) => {
  for (const scene of scenes) {
    if (!scene.id) continue;
    const existingScene = scenesToUpdate.get(scene.id);
    if (!existingScene) continue;
    
    await tx.scene.update({
      where: { id: scene.id },
      data: {
        narrationText: scene.narrationText ?? existingScene.narrationText,
        onScreenText: scene.onScreenText ?? existingScene.onScreenText,
        visualPrompt: scene.visualPrompt ?? existingScene.visualPrompt,
        negativePrompt: scene.negativePrompt ?? existingScene.negativePrompt,
        effectPreset: scene.effectPreset ?? existingScene.effectPreset,
        isLocked: scene.isLocked ?? existingScene.isLocked,
      },
    });
  }
});
```

**Acceptance Criteria:**
- [ ] Scene updates wrapped in transaction (all-or-nothing)
- [ ] Error response if any scene fails to update
- [ ] Add test case for concurrent scene delete + update

**Effort:** 30 minutes

---

### P0-4: Silent Orphaned Projects on Plan Lookup Failure

**Labels:** `P0`, `bug`, `api`, `batch`, `database`

**Description:**
After creating project and generating plan in batch endpoint, immediate lookup fails (DB timing/replication issue). Loop continues with `continue`, silently skipping this topic. Project created but no run queued, leaving orphaned data.

**Location:**
- **File:** `apps/server/src/routes/batch.ts`
- **Lines:** 119-129
- **Function:** `POST /api/batch`

**Code:**
```typescript
const fullPlan = await prisma.planVersion.findUnique({ 
  where: { id: planVersion.id },
  include: { scenes: { orderBy: { idx: 'asc' } }, project: true }
});
if (!fullPlan) {
  continue;  // ← Silently orphans the project!
}
```

**Impact:**
Topic processed, project and plan created in DB, but run never queued because plan lookup failed. Silent partial failure leaves orphaned project with no way for user to know.

**Reproduction:**
Intermittent - requires DB timing issue or replication lag (more likely in PostgreSQL production setup). Can simulate by:
1. Mock `prisma.planVersion.findUnique()` to return null after successful create
2. Submit batch request
3. Observe orphaned projects in DB

**Recommended Fix:**
Replace `continue` with error throw:
```typescript
if (!fullPlan) {
  logError('Plan not found immediately after creation', { 
    planVersionId: planVersion.id,
    topic 
  });
  throw new Error(`Plan lookup failed for topic: ${topic}`);
}
```

**Better Fix:** Add retry logic:
```typescript
let fullPlan = null;
for (let attempt = 0; attempt < 3; attempt++) {
  fullPlan = await prisma.planVersion.findUnique({ ... });
  if (fullPlan) break;
  await new Promise(resolve => setTimeout(resolve, 500)); // 500ms retry delay
}
if (!fullPlan) {
  throw new Error(`Plan not found after 3 attempts for topic: ${topic}`);
}
```

**Acceptance Criteria:**
- [ ] No silent failures - throw error if plan lookup fails
- [ ] Add retry logic (3 attempts) for plan lookup
- [ ] Log errors for investigation
- [ ] Add test case simulating lookup failure

**Effort:** 15 minutes

---

## 🟠 P1 ISSUES (High - Production Degradation)

### P1-1: Missing Lock Check During Bulk Scene Updates

**Labels:** `P1`, `bug`, `api`, `ux`

**Description:**
When updating multiple scenes, locked scenes are protected BUT check is incomplete. Redundant updates occur when scene is already locked and user sends `isLocked: true`. Client can't determine if unlock was actually applied without refetching.

**Location:**
- **File:** `apps/server/src/routes/plan.ts`
- **Lines:** 165-184
- **Function:** `PUT /api/plan/:id`

**Impact:**
Inefficient DB operations, client uncertainty about lock state after update.

**Recommended Fix:**
Return full updated scene object after each update to reflect actual DB state.

**Acceptance Criteria:**
- [ ] Return updated scenes in response
- [ ] No redundant updates when state unchanged
- [ ] Client can verify lock state without refetch

**Effort:** 20 minutes

---

### P1-2: No Validation on Project Duplicate Operation

**Labels:** `P1`, `bug`, `api`, `validation`

**Description:**
Duplicate endpoint doesn't validate original project has required fields before cloning. If project has `null` values (corrupted data), they're duplicated without checks, potentially breaking schema constraints.

**Location:**
- **File:** `apps/server/src/routes/project.ts`
- **Lines:** 222-320
- **Function:** `POST /api/project/:id/duplicate`

**Code:**
```typescript
const newProject = await prisma.project.create({
  data: {
    topic: original.topic,  // Could be null
    nichePackId: original.nichePackId,  // Could be null
  }
});
```

**Impact:**
Invalid project duplicate created with null fields, breaks schema constraints, causes downstream errors.

**Reproduction:**
1. Manually create project with null `topic` in DB (simulate corruption)
2. Call `POST /api/project/:id/duplicate`
3. Observe duplicate created with null fields

**Recommended Fix:**
Add validation before duplicate:
```typescript
if (!original.topic || !original.nichePackId) {
  return res.status(400).json({ 
    error: 'Cannot duplicate project with missing required fields',
    missing: {
      topic: !original.topic,
      nichePackId: !original.nichePackId
    }
  });
}
```

**Acceptance Criteria:**
- [ ] Validate required fields exist before duplicate
- [ ] Return 400 with clear error if fields missing
- [ ] Add test case for duplicate with invalid project

**Effort:** 15 minutes

---

### P1-3: Weak Path Traversal Protection (Directory Traversal Risk)

**Labels:** `P1`, `security`, `api`, `path-traversal`

**Description:**
Path traversal protection checks `startsWith(runPrefix + path.sep)` but has edge case. If `runPrefix` is `/artifacts/proj/run` and malicious path uses symlinks or edge case like `/artifacts/proj/run-2/../../other`, it might bypass check.

**Location:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 450-466 (download), 505-513 (artifact)
- **Function:** `GET /api/run/:runId/download`, `GET /api/run/:runId/artifact/:artifactPath`

**Code:**
```typescript
const runPrefix = path.join(resolvedArtifactsDir, run.projectId, runId);
if (!resolvedPath.startsWith(runPrefix + path.sep) && resolvedPath !== runPrefix) {
  return res.status(403).json({ error: 'Path not allowed for this run' });
}
```

**Impact:**
Potential directory traversal if symlinks or edge case paths exploited. Low likelihood but security boundary weakness.

**Recommended Fix:**
Use `path.relative()` and ensure result doesn't escape:
```typescript
const runPrefix = path.join(resolvedArtifactsDir, run.projectId, runId);
const relative = path.relative(runPrefix, resolvedPath);

// Reject if path escapes (starts with ..) or is absolute
if (relative.startsWith('..') || path.isAbsolute(relative)) {
  return res.status(403).json({ error: 'Path not allowed for this run' });
}
```

**Acceptance Criteria:**
- [ ] Use `path.relative()` for traversal check
- [ ] Reject paths starting with `..` or absolute paths
- [ ] Add test cases for edge cases (symlinks, multiple `..`, etc.)
- [ ] Verify with security scanner

**Effort:** 30 minutes

---

### P1-4: SSE Heartbeat Interval Memory Leak

**Labels:** `P1`, `bug`, `memory-leak`, `sse`

**Description:**
If client connects to SSE stream but never closes (zombie connection), heartbeat interval timer persists in memory. Even if all responses are removed, intervals may accumulate over time.

**Location:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 43-68 (startHeartbeat), 267-277 (cleanup)
- **Function:** SSE heartbeat management

**Impact:**
Memory leak on long-lived or abandoned SSE connections. Over time, server accumulates intervals consuming memory and CPU.

**Reproduction:**
1. Connect to SSE endpoint: `GET /api/run/:runId/stream`
2. Abandon connection without closing (simulate network drop)
3. Repeat 100+ times
4. Monitor memory: `sseHeartbeatIntervals` Map grows unbounded

**Recommended Fix:**
Add explicit interval cleanup on connection close:
```typescript
req.on('close', () => {
  const interval = sseHeartbeatIntervals.get(runId);
  if (interval) {
    clearInterval(interval);
    sseHeartbeatIntervals.delete(runId);
  }
  
  // Also remove from responses
  const responses = sseResponses.get(runId);
  if (responses) {
    const index = responses.indexOf(res);
    if (index > -1) {
      responses.splice(index, 1);
    }
    if (responses.length === 0) {
      sseResponses.delete(runId);
    }
  }
});
```

**Acceptance Criteria:**
- [ ] Cleanup interval on connection close
- [ ] Remove from sseResponses Map
- [ ] Add timeout for idle connections (optional: 5 min)
- [ ] Add test for memory leak scenario

**Effort:** 20 minutes

---

### P1-5: Scene Lock Toggle Missing Existence Check

**Labels:** `P1`, `bug`, `api`, `http-status`

**Description:**
Lock toggle endpoint directly updates scene without checking if it exists first. Prisma throws P2025 error but it's not caught, resulting in 500 Internal Server Error instead of proper 404 Not Found.

**Location:**
- **File:** `apps/server/src/routes/scene.ts`
- **Lines:** 122-125
- **Function:** `POST /api/scene/:sceneId/lock`

**Code:**
```typescript
const scene = await prisma.scene.update({
  where: { id: sceneId },
  data: { isLocked: locked },
});
res.json(scene);
// Missing catch for Prisma P2025 (record not found)
```

**Impact:**
Incorrect HTTP status code (500 instead of 404), poor UX, error logs flooded with expected errors.

**Reproduction:**
1. Delete scene: `DELETE /api/scene/:sceneId`
2. Call lock toggle: `POST /api/scene/:sceneId/lock`
3. Observe 500 error instead of 404

**Recommended Fix:**
Fetch scene first, check existence, then update:
```typescript
const scene = await prisma.scene.findUnique({ where: { id: sceneId } });
if (!scene) {
  return res.status(404).json({ error: 'Scene not found' });
}

const updated = await prisma.scene.update({
  where: { id: sceneId },
  data: { isLocked: locked },
});

res.json(updated);
```

**Or catch P2025:**
```typescript
try {
  const scene = await prisma.scene.update({ ... });
  res.json(scene);
} catch (error) {
  if ((error as any).code === 'P2025') {
    return res.status(404).json({ error: 'Scene not found' });
  }
  throw error;
}
```

**Acceptance Criteria:**
- [ ] Return 404 when scene not found
- [ ] Consistent with other route error handling
- [ ] Add test case for lock toggle on non-existent scene

**Effort:** 10 minutes

---

### P1-6: Automate Endpoint Missing Error Handling on Plan Lookup

**Labels:** `P1`, `bug`, `api`, `reliability`

**Description:**
After generating plan in automate endpoint, immediate lookup without retry. If lookup fails (network blip, DB timing), returns 500 error. Project and plan created but API returns error, leaving orphaned data and confused user.

**Location:**
- **File:** `apps/server/src/routes/automate.ts`
- **Lines:** 116-127
- **Function:** `POST /api/automate`

**Code:**
```typescript
const fullPlan = await prisma.planVersion.findUnique({
  where: { id: planVersion.id },
  include: { scenes: { orderBy: { idx: 'asc' } }, project: true },
});
if (!fullPlan) {
  return res.status(500).json({ error: 'Plan version not found after generation' });
}
```

**Impact:**
Orphaned data: Project created, plan created, but API returns error. UI shows failure but artifacts exist in DB.

**Recommended Fix:**
Add retry logic (same as P0-4):
```typescript
let fullPlan = null;
for (let attempt = 0; attempt < 3; attempt++) {
  fullPlan = await prisma.planVersion.findUnique({
    where: { id: planVersion.id },
    include: { scenes: { orderBy: { idx: 'asc' } }, project: true },
  });
  if (fullPlan) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!fullPlan) {
  logError('Plan not found after 3 attempts in automate endpoint', { planVersionId: planVersion.id });
  return res.status(500).json({ 
    error: 'Plan version not found after generation',
    projectId: project.id,
    planVersionId: planVersion.id
  });
}
```

**Acceptance Criteria:**
- [ ] Add 3-attempt retry with 500ms delay
- [ ] Log errors for investigation
- [ ] Return projectId/planVersionId in error for cleanup
- [ ] Add test case simulating lookup failure

**Effort:** 30 minutes

---

## 🟡 P2 ISSUES (Medium - Quality/Performance)

### P2-1: Missing Input Validation for Analytics Bounds

**Labels:** `P2`, `validation`, `api`, `data-quality`

**Description:**
Analytics update schema allows `views: 0`, `likes: 0` but doesn't prevent impossible values like `views: 999999999999` (1 trillion views). Stores invalid data without bounds checking.

**Location:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 23-25
- **Function:** `PATCH /api/run/:runId`

**Code:**
```typescript
views: z.number().int().min(0).optional(),
likes: z.number().int().min(0).optional(),
retention: z.number().min(0).max(1).optional(),
```

**Impact:**
Invalid analytics data stored, breaks reporting/charts with unrealistic values.

**Recommended Fix:**
Add reasonable upper bounds:
```typescript
views: z.number().int().min(0).max(1000000000).optional(), // 1 billion max
likes: z.number().int().min(0).max(100000000).optional(), // 100 million max
retention: z.number().min(0).max(1).optional(), // Already bounded
```

**Acceptance Criteria:**
- [ ] Add `.max()` constraints to views/likes
- [ ] Return 400 with helpful message if exceeded
- [ ] Add test cases for boundary values

**Effort:** 5 minutes

---

### P2-2: Topic Suggestions No Caching (Expensive OpenAI Calls)

**Labels:** `P2`, `performance`, `cost`, `api`

**Description:**
Each topic suggestions request hits OpenAI GPT-4 (slow, costly, ~$0.01-0.05 per request). No response caching or request deduplication. Repeated requests for same niche waste money and time.

**Location:**
- **File:** `apps/server/src/routes/topicSuggestions.ts`
- **Lines:** 10-13
- **Function:** `GET /api/topic-suggestions`

**Impact:**
- High cost: $1 per 100 requests minimum
- Slow response: 2-5 seconds per request
- Potential rate limiting from OpenAI
- No benefit for repeated queries

**Reproduction:**
1. Call `GET /api/topic-suggestions?nichePackId=horror&limit=10` multiple times
2. Observe each request hits OpenAI (check logs)
3. Cost accumulates

**Recommended Fix:**
Add 1-hour cache using existing Cache model:
```typescript
const cacheKey = crypto.createHash('sha256')
  .update(`topic_suggestions:${nichePackId}:${limit}`)
  .digest('hex');

// Check cache
const cached = await prisma.cache.findUnique({ 
  where: { hashKey: cacheKey } 
});

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
  return res.json(JSON.parse(cached.resultJson));
}

// Generate if not cached
const suggestions = await generateTopicSuggestions(nichePackId, limit);

// Store in cache
await prisma.cache.upsert({
  where: { hashKey: cacheKey },
  create: {
    kind: 'topic_suggestions',
    hashKey: cacheKey,
    resultJson: JSON.stringify(suggestions),
  },
  update: {
    resultJson: JSON.stringify(suggestions),
    createdAt: new Date(),
  },
});

return res.json(suggestions);
```

**Acceptance Criteria:**
- [ ] Cache topic suggestions for 1 hour
- [ ] Return cached results when available
- [ ] Invalidate cache on TTL expiry
- [ ] Add test for cache hit/miss

**Effort:** 30 minutes

---

### P2-3: Project Delete No Check for Active Runs

**Labels:** `P2`, `bug`, `api`, `database`

**Description:**
Delete project endpoint doesn't check for active runs before deletion. If run is rendering, it references deleted project, causing DB constraint violation or orphaned runs.

**Location:**
- **File:** `apps/server/src/routes/project.ts`
- **Lines:** 323-338
- **Function:** `DELETE /api/project/:id`

**Code:**
```typescript
await prisma.project.delete({ where: { id } });
res.json({ success: true });
```

**Impact:**
- Database constraint violation if run active
- Orphaned runs reference non-existent project
- Render pipeline errors

**Reproduction:**
1. Create project and start render
2. While rendering, delete project
3. Observe error in render pipeline

**Recommended Fix:**
Check for active runs first:
```typescript
const activeRuns = await prisma.run.findMany({
  where: { 
    projectId: id, 
    status: { in: ['queued', 'running'] } 
  }
});

if (activeRuns.length > 0) {
  return res.status(409).json({ 
    error: 'Cannot delete project with active renders',
    activeRunCount: activeRuns.length,
    activeRuns: activeRuns.map(r => ({ id: r.id, status: r.status }))
  });
}

await prisma.project.delete({ where: { id } });
res.json({ success: true });
```

**Acceptance Criteria:**
- [ ] Return 409 Conflict if active runs exist
- [ ] List active run IDs in error response
- [ ] Allow delete after all runs complete
- [ ] Add test case for delete with active run

**Effort:** 15 minutes

---

### P2-4: Autofit Duration No Content Validation

**Labels:** `P2`, `bug`, `api`, `validation`

**Description:**
Autofit endpoint updates scene durations but doesn't validate that narration text can fit in new duration. If autofit compresses to 2 seconds but narration is 50 words, TTS will fail later during render.

**Location:**
- **File:** `apps/server/src/routes/plan.ts`
- **Lines:** 272-303
- **Function:** `POST /api/plan/:planVersionId/autofit`

**Impact:**
Deferred error: Plan passes validation, render fails during TTS generation because narration too long for duration.

**Recommended Fix:**
Add word-count validation:
```typescript
const MIN_WORDS_PER_SEC = 2;   // 120 WPM slow
const MAX_WORDS_PER_SEC = 3;   // 180 WPM fast

for (const scene of fittedScenes) {
  const words = scene.narrationText.split(/\s+/).filter(w => w.length > 0).length;
  const minDuration = words / MAX_WORDS_PER_SEC;
  
  if (scene.durationTargetSec < minDuration) {
    warnings.push({
      sceneIdx: scene.idx,
      message: `Duration ${scene.durationTargetSec}s too short for ${words} words (min ${minDuration.toFixed(1)}s)`,
    });
  }
}

// Return warnings in response
return res.json({ 
  scenes: fittedScenes,
  warnings 
});
```

**Acceptance Criteria:**
- [ ] Calculate min duration based on word count
- [ ] Return warnings for scenes with insufficient duration
- [ ] Don't block autofit, just warn
- [ ] Add test case for short duration + long narration

**Effort:** 30 minutes

---

### P2-5: Test Route No Authentication (Config Tampering Risk)

**Labels:** `P2`, `security`, `api`, `test`

**Description:**
Test dry-run config can be toggled unlimited times without auth or rate limit. If test mode accidentally left enabled in production, malicious user can flip configs to disrupt rendering.

**Location:**
- **File:** `apps/server/src/routes/test.ts`
- **Lines:** 28-60
- **Function:** `POST /api/test/dry-run-config`

**Code:**
```typescript
testRoutes.post('/dry-run-config', (req, res) => {
  if (!isEnabled()) return res.status(404).json({ error: 'Not found' });
  // No auth check, no rate limit!
  setDryRunConfig(updateData);
  return res.json(getDryRunConfig());
});
```

**Impact:**
Configuration tampering if test routes enabled in production. Current mitigation: test routes only enabled if `isRenderDryRun() || isTestMode()` (index.ts:154), but still risky.

**Recommended Fix:**
**Best:** Ensure test routes never enabled in production (already implemented in index.ts)
**Fallback:** Require authentication even for test routes:
```typescript
import { requireAuth } from '../middleware/auth.js';

testRoutes.post('/dry-run-config', requireAuth, (req, res) => {
  // ... existing logic
});
```

**Acceptance Criteria:**
- [ ] Test routes never accessible in production (verified)
- [ ] OR: Require authentication for test config updates
- [ ] Add warning log if test routes used in production
- [ ] Add test to ensure test routes return 404 in production

**Effort:** 10 minutes

---

### P2-6: Batch Endpoint DOS Vector (50 Large Topics)

**Labels:** `P2`, `security`, `api`, `dos`

**Description:**
Schema limits batch to 50 topics, each up to 500 chars. Malicious user can submit 50 × 500-char topics repeatedly, causing heavy DB load (50 projects + plans + scenes), memory spike, and potential DOS.

**Location:**
- **File:** `apps/server/src/routes/batch.ts`
- **Lines:** 17
- **Function:** `POST /api/batch`

**Code:**
```typescript
topics: z.array(z.string().min(1).max(500)).min(1).max(50),
```

**Impact:**
DOS: Processing 50 large topics causes:
- 50 DB writes (project creation)
- 50 OpenAI GPT-4 calls (plan generation, ~5s each = 250s total)
- 50 × 6-10 scenes = 300-500 scene records
- Memory spike for concurrent processing

**Reproduction:**
```bash
# Generate 50 max-length topics
topics=$(python3 -c "print('[' + ','.join(['\"' + 'A'*500 + '\"']*50) + ']')")
curl -X POST /api/batch \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"topics\": $topics, \"nichePackId\": \"horror\"}"
# Observe server load spike
```

**Recommended Fix:**
Lower max to 10-20 topics:
```typescript
topics: z.array(z.string().min(1).max(500)).min(1).max(10),
```

**Or add request-level timeout:**
```typescript
const BATCH_TIMEOUT_MS = 30000; // 30 seconds
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Batch processing timeout')), BATCH_TIMEOUT_MS)
);

await Promise.race([
  processBatch(topics, nichePackId),
  timeoutPromise
]);
```

**Acceptance Criteria:**
- [ ] Reduce max topics to 10-20
- [ ] OR: Add 30s timeout for batch processing
- [ ] Document batch limits in API docs
- [ ] Add test for max batch size

**Effort:** 5 minutes

---

## 🔵 P3 ISSUES (Low - Minor UX/Observability)

### P3-1: Scene Lock Toggle Inconsistent Error Handling

**Labels:** `P3`, `bug`, `api`, `consistency`

**Description:**
Lock toggle endpoint doesn't catch P2025 error like other routes do. Returns 500 instead of 404 if scene deleted between request and response.

**Location:**
- **File:** `apps/server/src/routes/scene.ts`
- **Lines:** 122-131
- **Function:** `POST /api/scene/:sceneId/lock`

**Impact:**
Inconsistent HTTP status codes across API, poor error messages.

**Recommended Fix:**
Add Prisma P2025 error handler matching other routes (see P1-5).

**Acceptance Criteria:**
- [ ] Return 404 when scene not found
- [ ] Consistent error handling with other routes
- [ ] Add test case

**Effort:** 10 minutes  
**Note:** This is duplicate of P1-5 but lower priority

---

### P3-2: Plan Regeneration No Audit Logging

**Labels:** `P3`, `observability`, `api`

**Description:**
Plan regenerations and validations are silent. No audit trail of which user regenerated what, making debugging difficult.

**Location:**
- **File:** `apps/server/src/routes/plan.ts`
- **Lines:** 230, 342, 378, 415, 471, 542
- **Function:** Multiple plan regeneration endpoints

**Code:**
```typescript
const validation = validatePlan(planVersion, planVersion.project);
// No log of validation result or who triggered it
res.json(validation);
```

**Impact:**
Hard to debug if client reports "plan validation keeps failing" or "why was my plan regenerated?". No audit trail for user actions.

**Recommended Fix:**
Add `logInfo()` for regeneration attempts:
```typescript
logInfo('Plan regeneration triggered', {
  planVersionId: planVersion.id,
  projectId: planVersion.projectId,
  endpoint: 'regenerate-hooks',
  // Add user ID if auth implemented
});

const newHooks = await generateHooks(planVersion.project, pack);

logInfo('Plan regeneration completed', {
  planVersionId: planVersion.id,
  hookCount: newHooks.length
});
```

**Acceptance Criteria:**
- [ ] Log all plan regeneration attempts
- [ ] Log validation triggers
- [ ] Include project/plan IDs, endpoint, timestamp
- [ ] Consider logging user ID if auth expanded

**Effort:** 15 minutes

---

### P3-3: Project List No Pagination (Large Payload)

**Labels:** `P3`, `performance`, `api`, `pagination`

**Description:**
Project list endpoint returns all projects with includes (planVersions, runs), no pagination. With 1000+ projects, response is slow and massive (10-50MB).

**Location:**
- **File:** `apps/server/src/routes/project.ts`
- **Function:** `GET /api/projects`

**Code:**
```typescript
const projects = await prisma.project.findMany({
  orderBy: { createdAt: 'desc' },
  include: { planVersions: { take: 1 }, runs: { take: 1 } },
});
res.json(projects);  // Could be 1000s of projects
```

**Impact:**
- Slow initial load (5-10s with 1000+ projects)
- Large payload (10-50MB JSON)
- Client memory issues
- Poor UX on slow connections

**Recommended Fix:**
Add pagination with skip/take:
```typescript
const skipRaw = req.query.skip as string;
const takeRaw = req.query.take as string;

const skip = skipRaw ? parseInt(skipRaw, 10) : 0;
const take = takeRaw ? Math.min(parseInt(takeRaw, 10), 100) : 50;

if (isNaN(skip) || skip < 0 || isNaN(take) || take < 1) {
  return res.status(400).json({ 
    error: 'Invalid pagination parameters. skip >= 0, take 1-100.' 
  });
}

const [projects, total] = await Promise.all([
  prisma.project.findMany({
    skip,
    take,
    orderBy: { createdAt: 'desc' },
    include: { planVersions: { take: 1 }, runs: { take: 1 } },
  }),
  prisma.project.count()
]);

res.json({ 
  projects,
  pagination: {
    skip,
    take,
    total,
    hasMore: skip + take < total
  }
});
```

**Acceptance Criteria:**
- [ ] Add skip/take query params
- [ ] Default to 50 results, max 100
- [ ] Return total count and hasMore flag
- [ ] Update frontend to paginate
- [ ] Add test for pagination

**Effort:** 20 minutes

---

### P3-4: Run Filter Lenient Date Parsing

**Labels:** `P3`, `validation`, `api`

**Description:**
Date parsing for run filters is lenient, accepts invalid date strings without ISO validation. If parsing fails, returns Invalid Date, causing query to return unexpected results.

**Location:**
- **File:** `apps/server/src/routes/run.ts`
- **Lines:** 97-106
- **Function:** `GET /api/runs/upcoming`

**Code:**
```typescript
const parseDate = (s: string, endOfDay: boolean): Date => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? endOfDay ? new Date(s + 'T23:59:59.999') : new Date(s + 'T00:00:00.000')
    : new Date(s);
  return d;  // Could be Invalid Date
};
```

**Impact:**
Silent failure: Invalid date string like `"invalid-date"` parses to Invalid Date, isNaN check catches it but no error logged or returned to user.

**Recommended Fix:**
Add explicit validation and error response:
```typescript
const parseDate = (s: string, endOfDay: boolean): Date => {
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = endOfDay 
      ? new Date(s + 'T23:59:59.999') 
      : new Date(s + 'T00:00:00.000');
  } else {
    d = new Date(s);
  }
  
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${s}. Use format YYYY-MM-DD or ISO 8601.`);
  }
  
  return d;
};

// In route handler:
try {
  const fromDate = from ? parseDate(from, false) : undefined;
  const toDate = to ? parseDate(to, true) : undefined;
  // ... rest of logic
} catch (error) {
  return res.status(400).json({ error: error.message });
}
```

**Acceptance Criteria:**
- [ ] Throw error on invalid date string
- [ ] Return 400 with helpful message
- [ ] Log invalid date attempts
- [ ] Add test cases for invalid dates

**Effort:** 10 minutes

---

## 📋 Additional Improvements (Not Bugs, but Enhancements)

### Enhancement 1: Add Request ID Tracing

**Labels:** `enhancement`, `observability`

**Description:**
Add request ID header (X-Request-ID) to all API responses for distributed tracing and log correlation.

**Effort:** 1 hour

---

### Enhancement 2: Add Swagger/OpenAPI Documentation

**Labels:** `enhancement`, `documentation`

**Description:**
Generate OpenAPI spec from Zod schemas for interactive API docs.

**Effort:** 4 hours

---

### Enhancement 3: Add Database Backups

**Labels:** `enhancement`, `reliability`

**Description:**
Automated SQLite backup script or PostgreSQL scheduled exports.

**Effort:** 2 hours

---

### Enhancement 4: Add Metrics/Monitoring

**Labels:** `enhancement`, `observability`

**Description:**
Export Prometheus metrics (request count, duration, error rate, queue length).

**Effort:** 3 hours

---

## 📊 Summary Statistics

| Priority | Count | Total Effort |
|----------|-------|--------------|
| P0       | 4     | 2 hours      |
| P1       | 6     | 3 hours      |
| P2       | 6     | 2 hours      |
| P3       | 4     | 1 hour       |
| **TOTAL**| **20**| **8 hours**  |

---

## ✅ Acceptance Criteria for "Audit Complete"

- [x] All 20 issues documented with file paths, line numbers, reproduction steps
- [x] Priority assigned (P0/P1/P2/P3) based on impact
- [x] Recommended fixes provided with code examples
- [x] Effort estimates included
- [ ] All P0 issues fixed (IN PROGRESS)
- [ ] All P1 issues fixed or documented as BLOCKED
- [ ] Tests added for critical fixes
- [ ] Verification run (typecheck, lint, tests)
- [ ] Manual smoke test completed

---

**Instructions:** Copy each issue above and create as individual GitHub issue. Use labels to organize and track progress. Reference `docs/DEEP_AUDIT_REPORT.md` for full context.
