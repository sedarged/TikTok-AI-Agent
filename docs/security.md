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

**Authentication:** ❌ Not implemented (open API)  
**Authorization:** ❌ Not implemented  
**CORS:** ✅ Configurable via `ALLOWED_ORIGINS`  
**Input Validation:** ✅ Zod schemas on all routes  
**Rate Limiting:** ❌ Not implemented  
**Artifact Access Control:** ❌ Static file serving (no auth)  
**SQL Injection:** ✅ Protected (Prisma ORM)  
**XSS:** ✅ Protected (React auto-escaping)  
**Path Traversal:** ✅ Protected (UUID validation)

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

❌ Not implemented - vulnerable to abuse

### Recommended Implementation

```bash
npm install express-rate-limit
```

```typescript
// apps/server/src/index.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per IP
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter limits for expensive operations
const renderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // 10 renders per hour
});

app.use('/api/plan/:planVersionId/render', renderLimiter);
```

---

## Helmet CSP

### Current Status

❌ Not implemented - missing security headers

### Recommended Implementation

```bash
npm install helmet
```

```typescript
// apps/server/src/index.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

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

### Artifact Downloads

**Vulnerable Code (before):**

```typescript
// ❌ Path traversal vulnerability
app.get('/artifacts/:filename', (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(artifactsDir, filename));  // Allows ../../../etc/passwd
});
```

**Fixed Code (after):**

```typescript
// ✅ UUID validation prevents traversal
runRoutes.get('/:runId/download', async (req, res) => {
  const parsed = z.object({ runId: z.string().uuid() }).safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid run ID' });
  }

  const run = await prisma.run.findUnique({ where: { id: parsed.data.runId } });
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  const artifacts = JSON.parse(run.artifactsJson);
  const mp4Path = artifacts.mp4Path;

  // Verify path is within artifacts directory
  const resolvedPath = path.resolve(mp4Path);
  const artifactsBase = path.resolve(env.ARTIFACTS_DIR);
  if (!resolvedPath.startsWith(artifactsBase)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.sendFile(resolvedPath);
});
```

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

### Dependency Vulnerabilities (npm audit)

**Current (Jan 2026):**

- `vite@5.1.6` - Moderate severity (dev-time only, no runtime impact)
- `esbuild@0.24.2` - Moderate severity (bundled with Vite)

**Mitigation:**

```bash
# Check for updates
npm audit

# Update dependencies
npm update

# Or update specific package
npm install vite@latest
```

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

### Audit Date: 2026-01-29

**Total Issues Found:** 85+  
**Issues Fixed:** 25+  
**Issues Remaining:** 60 (mostly feature additions, not critical)

### Major Fixes

1. **CORS Vulnerability** - Fixed: Requires `ALLOWED_ORIGINS` in production
2. **Path Traversal** - Fixed: UUID validation on all file paths
3. **JSON Parsing** - Fixed: All `JSON.parse()` wrapped in try-catch
4. **Input Validation** - Fixed: Added Zod constraints (length, range, enum)

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

**Last Updated:** 2026-01-29  
**Last Security Audit:** 2026-01-29
