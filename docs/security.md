# Security Guide

Security implementation and best practices for TikTok-AI-Agent.

## Table of Contents

- [Current Security Status](#current-security-status)
- [CORS Configuration](#cors-configuration)
- [Input Validation](#input-validation)
- [Rate Limiting](#rate-limiting)
- [Helmet CSP](#helmet-csp)
- [Secret Management](#secret-management)
- [Path Traversal Protection](#path-traversal-protection)
- [JSON Parsing Safety](#json-parsing-safety)
- [Known Vulnerabilities](#known-vulnerabilities)
- [Security Audit Findings](#security-audit-findings)

---

## Current Security Status

**Authentication:** ✅ Implemented (API_KEY required for write operations)  
**Authorization:** ❌ Not implemented  
**CORS:** ✅ Configurable via `ALLOWED_ORIGINS`  
**Input Validation:** ✅ Zod schemas on all routes  
**Rate Limiting:** ✅ Implemented (general API + stricter batch limits)  
**Artifact Access Control:** ✅ Protected (path.relative() validation)  
**SQL Injection:** ✅ Protected (Prisma ORM)  
**XSS:** ✅ Protected (React auto-escaping + strict CSP)  
**Path Traversal:** ✅ Protected (UUID validation + path.relative())  
**Test Routes:** ✅ Protected (authentication + production gating)

---

## CORS Configuration

### Current Implementation

```typescript
// apps/server/src/index.ts
import cors from 'cors';
import { env } from './env.js';

const allowedOrigins = env.ALLOWED_ORIGINS;

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));
```

### Environment Configuration

```bash
# Development (allows all origins)
ALLOWED_ORIGINS=

# Production (strict whitelist)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Validation:**

```typescript
// apps/server/src/env.ts
ALLOWED_ORIGINS:
  process.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter((o) => o.startsWith('http://') || o.startsWith('https://')) || [],
```

### Security Fix (Jan 2026)

**Before:** Allowed all origins in production  
**After:** Requires explicit `ALLOWED_ORIGINS` configuration

---

## Input Validation

### Zod Schemas

All API routes validate input with Zod schemas in `apps/server/src/utils/apiSchemas.ts`.

**Example:**

```typescript
// apps/server/src/routes/project.ts
import { z } from 'zod';

const createProjectSchema = z.object({
  topic: z.string().min(1).max(500),           // Required, 1-500 chars
  nichePackId: z.string().min(1),              // Required
  targetLengthSec: z.number().int().positive().max(600).optional(),
  tempo: z.enum(['slow', 'normal', 'fast']).optional(),
}).strict();  // Reject unknown fields

projectRoutes.post('/', async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid project payload',
      details: parsed.error.flatten(),
    });
  }
  const { topic, nichePackId } = parsed.data;
  // ... safe to use validated data
});
```

### Validation Rules

**String Constraints:**

```typescript
z.string().min(1).max(500)     // Length limits
z.string().email()             // Email format
z.string().url()               // URL format
z.string().uuid()              // UUID format
```

**Number Constraints:**

```typescript
z.number().int()               // Integer only
z.number().positive()          // Greater than 0
z.number().min(0).max(100)     // Range
```

**Enum Validation:**

```typescript
z.enum(['slow', 'normal', 'fast'])  // Allowed values
```

**Strict Mode:**

```typescript
.strict()  // Reject extra fields (security)
```

### UUID Validation

```typescript
// Prevent path traversal via UUIDs
const projectIdSchema = z.object({
  id: z.string().uuid(),  // Only valid UUIDs accepted
});

projectRoutes.get('/:id', async (req, res) => {
  const parsed = projectIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  // Safe to use req.params.id
});
```

---

## Rate Limiting

### Current Status

✅ Implemented (as of Feb 2026)

### General API Rate Limiting

```typescript
// apps/server/src/index.ts
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevLikeForRateLimit ? 1000 : 100, // More permissive in development
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => isTestMode(), // Skip rate limiting in tests
});

app.use('/api/', apiLimiter);
```

### Batch Endpoint Rate Limiting

Stricter limits for expensive batch operations (Feb 2026):

```typescript
// apps/server/src/routes/batch.ts
const MAX_BATCH_TOPICS = 10; // Reduced from 50 to prevent DOS
const MAX_QUEUE_SIZE = 100; // Maximum queued/running renders

const batchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isNodeTest() ? 1000 : 5, // 5 requests per hour in production
  message: {
    error: 'Too many batch requests',
    message: 'You can only submit 5 batch requests per hour. Please try again later.',
    code: 'BATCH_RATE_LIMIT_EXCEEDED',
  },
});

batchRoutes.use(batchLimiter);
```

### Queue Size Protection

```typescript
// Check queue size before accepting batch
const queuedOrRunningCount = await prisma.run.count({
  where: { status: { in: ['queued', 'running'] } },
});

if (queuedOrRunningCount >= MAX_QUEUE_SIZE) {
  return res.status(503).json({
    error: 'Queue is full',
    code: 'QUEUE_FULL',
    queueSize: queuedOrRunningCount,
  });
}
```

---

## Helmet CSP

### Current Status

✅ Implemented (as of Feb 2026) - Strict CSP without unsafe-inline for scripts

### Implementation

```typescript
// apps/server/src/index.ts
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: isDevLikeForSecurityHeaders
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            // No 'unsafe-inline' for scripts - React+Vite apps don't need it
            scriptSrc: ["'self'"],
            // Keep 'unsafe-inline' for styles (Tailwind and CSS-in-JS requirement)
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
  })
);
```

### Security Improvements (Feb 2026)

1. **Removed `unsafe-inline` for scripts** - React+Vite bundled scripts don't require inline execution
2. **Added `fontSrc`** - Allows fonts from self and data URIs
3. **Added `objectSrc: ['none']`** - Blocks plugins (Flash, Java, etc.)
4. **Added `mediaSrc`** - Controls audio/video sources
5. **Added `frameSrc: ['none']`** - Prevents iframe embedding attacks

### Development Mode

CSP is disabled in development/test environments for hot reloading compatibility:

```typescript
const isDevLikeForSecurityHeaders =
  env.NODE_ENV === 'development' || env.NODE_ENV === 'test' || env.NODE_ENV === 'e2e';
```

---

## Test Routes Security

### Current Status

✅ Implemented (as of Feb 2026) - Authentication + production gating

### Implementation

```typescript
// apps/server/src/routes/test.ts
import { requireAuth } from '../middleware/auth.js';
import { isProduction } from '../env.js';

function isEnabled(): boolean {
  // Never enable test routes in production, even if dry-run flags are set
  if (isProduction()) {
    return false;
  }
  return isRenderDryRun() || isTestMode();
}

// Authentication required for all test endpoints
testRoutes.get('/dry-run-config', requireAuth, (req, res) => {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(getDryRunConfig());
});

testRoutes.post('/dry-run-config', requireAuth, (req, res) => {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  // ...
});
```

### Route Registration

Test routes are only registered when dry-run or test mode is enabled:

```typescript
// apps/server/src/index.ts
if (isRenderDryRun() || isTestMode()) {
  app.use('/api/test', testRoutes);
}
```

### Security Features

1. **Production Gating** - Test routes never enabled in `NODE_ENV=production`
2. **Authentication Required** - All endpoints require `requireAuth` middleware
3. **Conditional Registration** - Routes only registered in dry-run/test mode
4. **404 Fallback** - Double-check at endpoint level even if registered

### Test Coverage

Comprehensive test suite added (`tests/testRoutes.security.test.ts`):
- Production mode blocks all test routes
- Authentication required in development with API_KEY
- Works without auth when API_KEY not configured
- Properly handles invalid API keys
- Returns 404 when dry-run/test mode disabled

---

## Batch Endpoint Security

### Current Status

✅ Implemented (as of Feb 2026) - Reduced limits + rate limiting + queue protection

### DOS Prevention Measures

#### 1. Topic Count Limit

**Reduced from 50 to 10 topics per batch:**

```typescript
// apps/server/src/routes/batch.ts
const MAX_BATCH_TOPICS = 10; // Reduced from 50

const batchSchema = z.object({
  topics: z.array(z.string().min(1).max(500)).min(1).max(MAX_BATCH_TOPICS),
  // ...
}).strict();
```

**Rationale:** Each topic triggers OpenAI API calls and render pipeline execution. Limiting to 10 topics prevents excessive resource consumption.

#### 2. Rate Limiting

**Strict per-hour limit:**

```typescript
const batchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isNodeTest() ? 1000 : 5, // 5 requests per hour in production
  message: {
    error: 'Too many batch requests',
    message: 'You can only submit 5 batch requests per hour.',
    code: 'BATCH_RATE_LIMIT_EXCEEDED',
  },
});

batchRoutes.use(batchLimiter);
```

**Impact:** Maximum 50 videos per hour (5 batches × 10 topics)

#### 3. Queue Size Protection

**Reject batches when queue is full:**

```typescript
const MAX_QUEUE_SIZE = 100;

const queuedOrRunningCount = await prisma.run.count({
  where: { status: { in: ['queued', 'running'] } },
});

if (queuedOrRunningCount >= MAX_QUEUE_SIZE) {
  return res.status(503).json({
    error: 'Queue is full',
    code: 'QUEUE_FULL',
    queueSize: queuedOrRunningCount,
  });
}
```

#### 4. Queue Overflow Protection

**Reject batches that would exceed queue limit:**

```typescript
if (queuedOrRunningCount + topics.length > MAX_QUEUE_SIZE) {
  return res.status(503).json({
    error: 'Batch would exceed queue capacity',
    code: 'BATCH_EXCEEDS_QUEUE_LIMIT',
    currentQueueSize: queuedOrRunningCount,
    requestedBatchSize: topics.length,
    maxQueueSize: MAX_QUEUE_SIZE,
  });
}
```

### Cost Protection

Combined with authentication (`requireAuth` for write operations), these limits protect against:
- DOS attacks (overwhelming server resources)
- Cost abuse (excessive OpenAI API usage)
- Queue exhaustion (blocking legitimate users)

### Test Coverage

Comprehensive test suite added (`tests/batchLimits.security.test.ts`):
- Rejects batches > 10 topics
- Validates empty/whitespace topics
- Rejects when queue is full (100 items)
- Rejects batches that would exceed queue
- Validates niche pack and topic length
- Ensures authentication when API_KEY configured

---

## Secret Management

### Environment Variables

**Never commit `.env` file:**

```bash
# .gitignore
.env
.env.local
.env.*.local
```

**Use `.env.example` as template:**

```bash
# .env.example (safe to commit)
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
DATABASE_URL=file:./dev.db
```

### Production Secrets

**Option 1: Platform Environment Variables**

```bash
# Railway
railway variables set OPENAI_API_KEY=sk-proj-...

# Heroku
heroku config:set OPENAI_API_KEY=sk-proj-...

# AWS
aws secretsmanager create-secret --name tiktok-ai/openai-key --secret-string sk-proj-...
```

**Option 2: Docker Secrets**

```bash
# Create secret
echo "sk-proj-..." | docker secret create openai_key -

# Use in docker-compose.yml
services:
  app:
    secrets:
      - openai_key
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_key

secrets:
  openai_key:
    external: true
```

### API Key Rotation

```bash
# 1. Generate new key in OpenAI dashboard
# 2. Update environment variable
railway variables set OPENAI_API_KEY=sk-proj-NEW_KEY

# 3. Restart service
railway up

# 4. Delete old key from OpenAI dashboard
```

---

## Path Traversal Protection

### Current Status

✅ Fixed (as of Feb 2026) - Using `path.relative()` validation

### Artifact Downloads

**Fixed Implementation (Feb 2026):**

```typescript
// ✅ Secure path validation using path.relative()
runRoutes.get('/:runId/download', async (req, res) => {
  const parsed = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid run ID' });
  }

  const run = await prisma.run.findUnique({ where: { id: parsed.data.runId } });
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  const artifacts = safeJsonParse<Artifacts | null>(run.artifactsJson, null);
  if (!artifacts || !artifacts.mp4Path) {
    logError('Missing artifacts.mp4Path for run', { runId: run.id, artifacts });
    return res.status(500).json({ error: 'Video artifacts not available' });
  }

  const videoPath = path.join(env.ARTIFACTS_DIR, artifacts.mp4Path);
  const resolvedPath = path.resolve(videoPath);
  const resolvedArtifactsDir = path.resolve(env.ARTIFACTS_DIR);

  // Use path.relative() for secure path validation
  const relativePath = path.relative(resolvedArtifactsDir, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    logError('Path traversal attempt detected:', artifacts.mp4Path);
    return res.status(403).json({ error: 'Invalid file path' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'Video file not found on disk' });
  }

  // Additional symlink protection: resolve real paths and verify containment
  try {
    const realPath = fs.realpathSync(resolvedPath);
    const realArtifactsDir = fs.realpathSync(resolvedArtifactsDir);
    const realRelative = path.relative(realArtifactsDir, realPath);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      logError('Symlink escape attempt detected:', artifacts.mp4Path);
      return res.status(403).json({ error: 'Invalid file path' });
    }
  } catch (error) {
    logError('Error resolving real path:', error);
    return res.status(403).json({ error: 'Invalid file path' });
  }

  res.download(resolvedPath, 'final.mp4');
});
```

### Artifact Endpoint

**Fixed Implementation (Feb 2026):**

```typescript
// ✅ Dual path validation: artifacts dir + run-specific dir
runRoutes.get('/:runId/artifact', async (req, res) => {
  const fullPath = path.join(env.ARTIFACTS_DIR, normalizedPath);
  const resolvedPath = path.resolve(fullPath);
  const resolvedArtifactsDir = path.resolve(env.ARTIFACTS_DIR);
  const runPrefix = path.join(resolvedArtifactsDir, run.projectId, runId);

  // Use path.relative() for secure path validation
  const relativeToArtifacts = path.relative(resolvedArtifactsDir, resolvedPath);
  if (relativeToArtifacts.startsWith('..') || path.isAbsolute(relativeToArtifacts)) {
    return res.status(403).json({ error: 'Invalid file path' });
  }
  
  const relativeToRun = path.relative(runPrefix, resolvedPath);
  if (relativeToRun.startsWith('..') || path.isAbsolute(relativeToRun)) {
    return res.status(403).json({ error: 'Path not allowed for this run' });
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Additional symlink protection: resolve real paths and verify containment
  try {
    const realPath = fs.realpathSync(resolvedPath);
    const realArtifactsDir = fs.realpathSync(resolvedArtifactsDir);
    const realRunPrefix = fs.realpathSync(runPrefix);
    
    const realRelativeToArtifacts = path.relative(realArtifactsDir, realPath);
    if (realRelativeToArtifacts.startsWith('..') || path.isAbsolute(realRelativeToArtifacts)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    const realRelativeToRun = path.relative(realRunPrefix, realPath);
    if (realRelativeToRun.startsWith('..') || path.isAbsolute(realRelativeToRun)) {
      return res.status(403).json({ error: 'Path not allowed for this run' });
    }
  } catch (error) {
    logError('Error resolving real path:', error);
    return res.status(403).json({ error: 'Invalid file path' });
  }

  res.sendFile(resolvedPath);
});
```

### Security Improvements (Feb 2026)

1. **Use `path.relative()` instead of string `startsWith()` checks** - More robust against malformed relative paths and path traversal attempts (purely string-based; does **not** resolve or block symlinks)
2. **Check for `..` in relative path** - Prevents directory traversal via `../` segments
3. **Check if relative path is absolute** - Prevents absolute path bypass after resolution
4. **Dual validation** - Artifact endpoint validates both base dir and run-specific dir
5. **Symlink protection** - Use `fs.realpathSync()` to resolve symlinks and verify the real path is still within the allowed directory

> ⚠️ **Symlink note:** The `path.relative()` checks operate on normalized path strings only and do **not** resolve symlinks by themselves. To prevent symlink escape from `ARTIFACTS_DIR` (e.g. a symlink inside the directory pointing outside), we additionally:
>
> - Use `fs.realpathSync()` on both `ARTIFACTS_DIR` and the candidate file path
> - Verify that the file's real path still has the artifacts dir as a prefix

### Test Coverage

Comprehensive test suite added (`tests/pathTraversal.security.test.ts`):
- Path traversal with `../` sequences
- Absolute path attempts
- URL-encoded traversal attempts
- Cross-run directory access prevention
- Valid path acceptance (positive tests)
- (Symlink behavior is protected by `fs.realpathSync()` validation)

---

## JSON Parsing Safety

### Issue

Bare `JSON.parse()` throws on invalid input, crashing the application.

### Fix

**All JSON.parse() calls wrapped in try-catch:**

```typescript
// ✅ Safe JSON parsing
let parsed = {};
try {
  parsed = JSON.parse(jsonString);
} catch (error) {
  logError('Failed to parse JSON', error);
  parsed = {};  // Safe default
}

// ❌ Unsafe (before)
const parsed = JSON.parse(jsonString);  // Throws on invalid JSON
```

**Examples from codebase:**

```typescript
// apps/server/src/routes/run.ts
let logs: any[] = [];
try {
  logs = JSON.parse(run.logsJson);
} catch (error) {
  logError('Failed to parse logs JSON', error);
  logs = [];
}

let artifacts: any = {};
try {
  artifacts = JSON.parse(run.artifactsJson);
} catch (error) {
  logError('Failed to parse artifacts JSON', error);
  artifacts = {};
}
```

---

## Known Vulnerabilities

### Active Code-Level Vulnerabilities

✅ **All vulnerabilities from Feb 2026 audit have been fixed!**

### Fixed Vulnerabilities (Feb 2026)

#### 1. Path Traversal Weakness (P1 - High Priority) ✅ FIXED

**Status:** FIXED (Feb 2026)  
**Location:** `apps/server/src/routes/run.ts`  
**Severity:** HIGH  
**Issue:** `startsWith()` check for artifact path validation had edge cases with symlinks

**Fix Applied:**
```typescript
// Before (vulnerable):
if (!artifactPath.startsWith(artifactsDir)) {
  return res.status(403).json({ error: 'Access denied' });
}

// After (secure):
const relativePath = path.relative(artifactsDir, artifactPath);
if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
  return res.status(403).json({ error: 'Invalid file path' });
}
```

**Testing:** 8 comprehensive security tests added  
**Evidence:** ISSUES_TODO.md (Issue 1: Path Traversal Weakness)  
**Fixed:** 2026-02-07

---

#### 2. Weak CSP Policy (P3 - Low Priority) ✅ FIXED

**Status:** FIXED (Feb 2026)  
**Location:** `apps/server/src/index.ts`  
**Severity:** LOW  
**Issue:** Content Security Policy allowed `unsafe-inline` for scripts

**Fix Applied:**
```typescript
// Before:
scriptSrc: ['self', 'unsafe-inline']

// After:
scriptSrc: ['self']  // Removed unsafe-inline
```

**Additional Improvements:**
- Added `fontSrc`, `objectSrc`, `mediaSrc`, `frameSrc` directives
- Kept `unsafe-inline` for styles (required for Tailwind)

**Evidence:** ISSUES_TODO.md (Issue 2: Weak CSP Policy)  
**Fixed:** 2026-02-07

---

#### 3. Test Route Missing Authentication (P2 - Medium Priority) ✅ FIXED

**Status:** FIXED (Feb 2026)  
**Location:** `apps/server/src/routes/test.ts`  
**Severity:** MEDIUM  
**Issue:** Test dry-run configuration endpoint could be toggled without authentication

**Fix Applied:**
```typescript
// Before:
testRoutes.post('/dry-run-config', async (req, res) => {
  // No auth middleware
});

// After:
import { requireAuth } from '../middleware/auth.js';
testRoutes.post('/dry-run-config', requireAuth, (req, res) => {
  // Now requires authentication
});

// Plus production gating:
function isEnabled(): boolean {
  if (isProduction()) {
    return false; // Never enable in production
  }
  return isRenderDryRun() || isTestMode();
}
```

**Testing:** 8 comprehensive security tests added  
**Evidence:** ISSUES_TODO.md (Issue 3: Test Route Missing Authentication)  
**Fixed:** 2026-02-07

---

#### 4. Batch Endpoint DOS Vector (P2 - Medium Priority) ✅ FIXED

**Status:** FIXED (Feb 2026)  
**Location:** `apps/server/src/routes/batch.ts`  
**Severity:** MEDIUM  
**Issue:** Batch endpoint accepted up to 50 topics, could be used for DOS attacks

**Fix Applied:**
1. **Reduced max topics:** 50 → 10
2. **Added dedicated rate limiter:** 5 requests/hour in production
3. **Added queue size validation:** Rejects if >100 queued/running renders
4. **Added queue overflow protection:** Rejects batch if it would exceed limit

**Testing:** 9 comprehensive security tests added  
**Evidence:** ISSUES_TODO.md (Issue 12: Batch Endpoint DOS Vector)  
**Fixed:** 2026-02-07

---

### Dependency Vulnerabilities (npm audit)

**Current (Feb 2026):**

✅ **0 vulnerabilities** - All dependency vulnerabilities have been fixed using npm overrides:

- `hono` - Fixed: 4.11.4 → 4.11.7 (XSS, cache deception, IPv4 validation)
- `lodash` - Fixed: Chevrotain 11.1.1 switched to lodash-es
- `chevrotain` - Fixed: 10.5.0 → 11.1.1

**Details:** Complete fix documentation is in docs/security.md (Dependency Vulnerabilities section).

**Verification:**

```bash
# Check for updates
npm audit
# found 0 vulnerabilities

# Update dependencies
npm update

# Or update specific package
npm install vite@latest
```

---

### Artifacts Access Control

**Issue:** Artifacts served as static files without authentication

**Current:**

```typescript
app.use('/artifacts', express.static(env.ARTIFACTS_DIR));
```

**Recommended Fix:**

```typescript
app.use('/artifacts', authMiddleware, express.static(env.ARTIFACTS_DIR));
```

**Or move to cloud storage:**

```typescript
// Upload to S3
await s3.putObject({
  Bucket: 'tiktok-ai-artifacts',
  Key: `${runId}/final.mp4`,
  Body: fs.createReadStream(videoPath),
});

// Generate signed URL (expires in 1 hour)
const signedUrl = await s3.getSignedUrlPromise('getObject', {
  Bucket: 'tiktok-ai-artifacts',
  Key: `${runId}/final.mp4`,
  Expires: 3600,
});
```

---

## Security Audit Findings

### Latest Audit: 2026-02-06

**Repository Cleanup Audit**  
**Focus:** Documentation consolidation, security review, code quality

**Security Findings:**
- 3 active code-level vulnerabilities identified (documented above)
- 0 dependency vulnerabilities (all fixed with npm overrides)
- Multiple completed security fixes verified and documented

**Previous Audit: 2026-01-29**

**Total Issues Found:** 85+  
**Issues Fixed:** 25+  
**Issues Remaining:** 60 (mostly feature additions, not critical)

### Major Fixes (Jan 2026 Audit)

1. **CORS Vulnerability** - ✅ Fixed: Requires `ALLOWED_ORIGINS` in production
2. **Input Validation** - ✅ Fixed: UUID validation added for all file path parameters
3. **JSON Parsing** - ✅ Fixed: All `JSON.parse()` wrapped in try-catch
4. **Input Validation** - ✅ Fixed: Added Zod constraints (length, range, enum)
5. **Dependency Vulnerabilities** - ✅ Fixed: 8 moderate vulnerabilities resolved (Feb 2026)

**Note on Path Traversal:** UUID validation prevents most path traversal attacks by ensuring only valid UUID-based paths are accepted. However, a secondary weakness in artifact download validation (using `startsWith()` check) remains and is documented as an active vulnerability above.

### Completed Fixes (Feb 2026 Audit)

Verified in AUDIT_SUMMARY_COMMENT.md:

1. **Silent failure on empty batch topics** - ✅ Fixed: Added validation + error response
2. **Batch fail-fast without rollback** - ✅ Fixed: Two-phase processing + rollback
3. **Scene update race condition** - ✅ Fixed: Wrapped in Prisma transaction
4. **Silent orphaned projects** - ✅ Fixed: Added 3-attempt retry + error
5. **Scene lock missing check** - ✅ Fixed: Added existence check + P2025 handler
6. **Automate missing error handling** - ✅ Fixed: Added 3-attempt retry + errors
7. **Project delete no run check** - ✅ Fixed: Returns 409 if active runs exist
8. **SSE heartbeat cleanup** - ✅ Verified: Cleanup code already exists

### Remaining Tasks

1. ❌ Add authentication middleware
2. ❌ Implement rate limiting
3. ❌ Add Helmet security headers
4. ❌ Move artifacts to cloud storage
5. ❌ Add artifact access control
6. ❌ Implement API key rotation
7. ❌ Add request logging
8. ❌ Add security monitoring

See [roadmap.md](roadmap.md) for implementation plan.

---

## Security Checklist

**Before Production Deployment:**

- [ ] Set `ALLOWED_ORIGINS` to production domains
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (configure reverse proxy)
- [ ] Add authentication for sensitive endpoints
- [ ] Enable rate limiting
- [ ] Add security headers (Helmet)
- [ ] Rotate API keys
- [ ] Set up automated backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated
- [ ] Use process manager (PM2/systemd)
- [ ] Configure firewall rules
- [ ] Implement secrets management
- [ ] Set up monitoring and alerting

---

## Related Documentation

- [SECURITY.md](../SECURITY.md) - Security policy
- [deployment.md](deployment.md) - Production deployment
- [operations-runbook.md](operations-runbook.md) - Security incidents

---

**Last Updated:** 2026-02-07  
**Last Security Audit:** 2026-02-07 (Security Hardening - Path Traversal, CSP, Test Routes, Batch Limits)
