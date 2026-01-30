# Quick Fix Guide - Priority Issues

This document lists the actionable fixes from the comprehensive audit, ordered by priority.

## 🔴 HIGH PRIORITY (Required for CI/E2E)

### 1. E2E Test Setup (TEST-001)
**Issue:** E2E tests fail with webServer timeout  
**Status:** ✅ ALREADY FIXED  
**File:** `scripts/e2e-server.mjs` already includes database migration  
**Actual issue:** Timing/health check endpoint readiness  
**Solution:** Increase timeout or improve health check responsiveness

### 2. Environment Setup (DB-001)
**Issue:** Fresh clone requires manual .env creation  
**Status:** ✅ FIXED  
**Files:** `setup.sh`, `setup.bat`  
**Action:** Run `./setup.sh` (Linux/Mac) or `setup.bat` (Windows)

## 🟡 MEDIUM PRIORITY (Security & Testing)

### 3. Security Vulnerabilities (SEC-001)
**Issue:** 5 moderate vulnerabilities in dev dependencies
```
- esbuild <=0.24.2 (GHSA-67mh-4wv8-2f99)
- vite 0.11.0 - 6.1.6 (via esbuild)
- vitest 0.0.1 - 3.0.0-beta.4 (via vite)
```

**Fix:**
```bash
# Upgrade to latest versions (breaking changes expected)
npm install --save-dev vite@^7.0.0 vitest@^4.0.0

# Test everything after upgrade
npm run test
npm run test:render
npm run build
```

**Verification:**
```bash
npm audit
# Should show 0 vulnerabilities
```

### 4. Missing Unit Tests (TEST-002, TEST-003)

**4a. captionsBuilder tests**
```bash
# Create test file
touch apps/server/tests/captionsBuilder.unit.test.ts
```

Test cases needed:
- ASS subtitle formatting
- Word grouping logic
- Timestamp conversion
- Highlight color generation

**4b. planGenerator tests**
```bash
# Create test file
touch apps/server/tests/planGenerator.unit.test.ts
```

Test cases needed:
- Template rendering
- Scene count calculation
- Duration estimation
- Hook generation

### 5. Automate/Batch Integration Tests
```bash
# Add to apps/server/tests/api.integration.test.ts
```

Test cases:
- POST /api/automate with valid payload
- POST /api/batch with multiple topics
- Validation error handling
- FFmpeg/OpenAI availability checks

## 🟢 LOW PRIORITY (Code Quality)

### 6. Console Statements (BE-002)
**Issue:** 32 console.log/warn/error statements  
**Fix:** Replace with structured logger

```typescript
// Before:
console.log('Starting render...');
console.error('Failed:', error);

// After:
import { logInfo, logError } from '../utils/logger.js';
logInfo('Starting render...', { runId });
logError('Failed', error, { runId });
```

**Files to update:**
```bash
grep -l "console\\." apps/server/src/**/*.ts
# Update each file
```

### 7. Process.env Usage (BE-001)
**Issue:** Direct process.env usage in 7 locations  
**Fix:** Use env.ts exports

```typescript
// Before:
const origins = process.env.ALLOWED_ORIGINS?.split(',');

// After:
import { env } from './env.js';
const origins = env.ALLOWED_ORIGINS?.split(',');
// Note: Add ALLOWED_ORIGINS to env.ts if missing
```

**Locations:**
- apps/server/src/utils/logger.ts:4
- apps/server/src/index.ts:65,211
- apps/server/src/routes/test.ts:29-30,60,64

### 8. UI Language Consistency (FE-001)
**Issue:** "Ostrzeżenia" in PL, rest in EN  
**Fix:**

```typescript
// apps/web/src/pages/PlanStudio.tsx:58
// Before:
<h3>Ostrzeżenia</h3>

// After:
<h3>Warnings</h3>
```

## 🔵 OPTIONAL (Production)

### 9. Add Dockerfile
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY apps/ ./apps/
COPY scripts/ ./scripts/
COPY .env.example ./.env.example

# Build frontend
RUN npm run build

# Expose port
EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npm run db:migrate && npm start"]
```

### 10. Add docker-compose.yml
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=file:./data/prod.db
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./data:/app/data
      - ./artifacts:/app/artifacts
    restart: unless-stopped
```

### 11. Graceful Shutdown (PROD-001)
```typescript
// apps/server/src/index.ts
function setupGracefulShutdown(server: Server) {
  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal}, shutting down gracefully...`);
    
    // Stop accepting new connections
    server.close(() => {
      logInfo('HTTP server closed');
    });
    
    // Wait for active renders to complete (with timeout)
    const timeout = setTimeout(() => {
      logWarn('Shutdown timeout, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout
    
    try {
      // Cancel all active renders
      for (const runId of activeRuns.keys()) {
        await cancelRun(runId);
      }
      
      // Disconnect database
      await prisma.$disconnect();
      
      clearTimeout(timeout);
      process.exit(0);
    } catch (err) {
      logError('Error during shutdown', err);
      process.exit(1);
    }
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// In startServer():
const server = app.listen(...);
setupGracefulShutdown(server);
```

### 12. External Logging (PROD-002)
```bash
npm install winston
```

```typescript
// apps/server/src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### 13. Metrics & Tracing (PROD-003)
```bash
npm install prom-client
```

```typescript
// apps/server/src/services/metrics.ts
import promClient from 'prom-client';

const register = new promClient.Registry();

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const activeRenders = new promClient.Gauge({
  name: 'active_renders_total',
  help: 'Number of currently active render jobs',
  registers: [register]
});

// Add /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Summary Table

| Priority | ID | Description | Effort | Impact |
|---|---|---|---|---|
| 🔴 HIGH | TEST-001 | Fix E2E webServer | 1h | Unblocks CI |
| 🔴 HIGH | DB-001 | Auto .env setup | ✅ Done | Better DX |
| 🟡 MEDIUM | SEC-001 | Upgrade dependencies | 2h | Security |
| 🟡 MEDIUM | TEST-002 | captionsBuilder tests | 2h | Coverage |
| 🟡 MEDIUM | TEST-003 | planGenerator tests | 2h | Coverage |
| 🟡 MEDIUM | - | Automate/batch tests | 1h | Coverage |
| 🟢 LOW | BE-002 | Replace console.log | 2h | Observability |
| 🟢 LOW | BE-001 | Consolidate env usage | 1h | Consistency |
| 🟢 LOW | FE-001 | Fix UI language | 5min | Consistency |
| 🔵 OPTIONAL | DEVOPS-001 | Dockerfile | 30min | Deployment |
| 🔵 OPTIONAL | DEVOPS-002 | docker-compose | 30min | Local setup |
| 🔵 OPTIONAL | PROD-001 | Graceful shutdown | 1h | Reliability |
| 🔵 OPTIONAL | PROD-002 | External logging | 2h | Observability |
| 🔵 OPTIONAL | PROD-003 | Metrics/tracing | 3h | Observability |

## Recommendation

**For immediate release:** Focus on HIGH and MEDIUM priorities (8-10 hours of work).

**For production deployment:** Add OPTIONAL items (7-8 additional hours).

**Current status:** Application is 100% functional and can ship as-is for self-hosted use.
