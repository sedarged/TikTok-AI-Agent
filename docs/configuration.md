# Configuration Reference

Complete environment variable reference for TikTok-AI-Agent. All configuration is managed through environment variables defined in `.env` file (development) or platform settings (production).

## Table of Contents

- [Quick Start](#quick-start)
- [Core Variables](#core-variables)
- [Path Configuration](#path-configuration)
- [Test & Dry-Run Modes](#test--dry-run-modes)
- [Optional Variables](#optional-variables)
- [Environment-Specific Configuration](#environment-specific-configuration)
  - [Development](#development)
  - [Production](#production)
  - [Docker](#docker)
  - [Railway.app](#railwayapp)
- [Validation & Defaults](#validation--defaults)
- [Security Considerations](#security-considerations)

---

## Quick Start

Copy `.env.example` to `.env` and configure required variables:

```bash
cp .env.example .env
```

Minimum required configuration:

```bash
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=file:./dev.db
PORT=3001
NODE_ENV=development
```

---

## Core Variables

### `PORT`

- **Type:** Integer (1-65535)
- **Default:** `3001`
- **Required:** No
- **Description:** HTTP server port
- **Example:** `PORT=3001`
- **Validation:** Must be valid port number; throws error if invalid

```typescript
// apps/server/src/env.ts:44-46
const port = parseInt(process.env.PORT || '3001', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535.`);
}
```

### `NODE_ENV`

- **Type:** String enum: `development` | `production` | `test`
- **Default:** `development`
- **Required:** No
- **Description:** Application environment mode
- **Example:** `NODE_ENV=production`
- **Effects:**
  - **Production:** Enables security validations, requires explicit `DATABASE_URL`, warns if `OPENAI_API_KEY` missing
  - **Development:** Relaxed validation, verbose logging
  - **Test:** Used by test suite, enables deterministic mocks

### `DATABASE_URL`

- **Type:** Connection string (SQLite or PostgreSQL)
- **Default:** `file:./dev.db`
- **Required:** Yes (in production)
- **Description:** Prisma database connection URL
- **Examples:**
  - SQLite: `DATABASE_URL=file:./dev.db`
  - PostgreSQL: `DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_ai`
- **Validation:** Production requires explicit value (not default)

```typescript
// apps/server/src/env.ts:33-35
if (isProduction && !process.env.DATABASE_URL) {
  logBootstrapWarn('DATABASE_URL not set in production. Using default ./dev.db');
}
```

### `OPENAI_API_KEY`

- **Type:** String (API key)
- **Default:** Empty string
- **Required:** Yes (unless `APP_TEST_MODE=1`)
- **Description:** OpenAI API key for GPT-4, DALL-E 3, Whisper, TTS
- **Example:** `OPENAI_API_KEY=sk-proj-abc123...`
- **Validation:** Warns in production if missing (unless test mode)
- **Security:** Never commit to version control; rotate regularly

```typescript
// apps/server/src/env.ts:71-76
export function isOpenAIConfigured(): boolean {
  if (env.APP_TEST_MODE) {
    return false;
  }
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0);
}
```

### `ELEVENLABS_API_KEY`

- **Type:** String (API key)
- **Default:** Empty string
- **Required:** No
- **Description:** ElevenLabs API key for advanced TTS (optional)
- **Example:** `ELEVENLABS_API_KEY=abc123...`
- **Note:** Currently optional; OpenAI TTS is default provider

---

## Path Configuration

Paths are resolved relative to repository root if not explicitly set.

### `MUSIC_LIBRARY_DIR`

- **Type:** Absolute path
- **Default:** `<repo_root>/assets/music`
- **Required:** No
- **Description:** Directory containing background music files
- **Example:** `MUSIC_LIBRARY_DIR=/app/assets/music`

### `ARTIFACTS_DIR`

- **Type:** Absolute path
- **Default:** `<repo_root>/artifacts`
- **Required:** No
- **Description:** Directory for generated videos, images, audio
- **Example:** `ARTIFACTS_DIR=/app/artifacts`
- **Security:** In production, ensure proper access control (see [Security](#security-considerations))

```typescript
// apps/server/src/env.ts:17-23
function getRootDir(): string {
  // If we're in apps/server, go up two levels
  if (process.cwd().includes('apps/server') || process.cwd().includes('apps\\server')) {
    return path.resolve(process.cwd(), '..', '..');
  }
  return process.cwd();
}

const rootDir = getRootDir();

// apps/server/src/env.ts:57-58
MUSIC_LIBRARY_DIR: process.env.MUSIC_LIBRARY_DIR || path.resolve(rootDir, 'assets', 'music'),
ARTIFACTS_DIR: process.env.ARTIFACTS_DIR || path.resolve(rootDir, 'artifacts'),
```

---

## Test & Dry-Run Modes

Special modes for testing and development without external API calls.

### `APP_TEST_MODE`

- **Type:** Boolean (`1` or `0`)
- **Default:** `0`
- **Required:** No
- **Description:** Enables deterministic mocks for all external APIs (no real API calls)
- **Example:** `APP_TEST_MODE=1`
- **Effects:**
  - Plan generation returns deterministic mock data
  - OpenAI/ElevenLabs always return `false` for `isConfigured()`
  - Used by unit tests in `apps/server/tests/`

```typescript
// apps/server/tests/setup.ts:1
process.env.APP_TEST_MODE ??= '1';
```

### `APP_RENDER_DRY_RUN`

- **Type:** Boolean (`1` or `0`)
- **Default:** `0`
- **Required:** No
- **Description:** Runs full render pipeline without external API calls; outputs empty files
- **Example:** `APP_RENDER_DRY_RUN=1`
- **Use Case:** Test render orchestration without paying for OpenAI/FFmpeg
- **Note:** Overridden by `APP_TEST_MODE`

```typescript
// apps/server/src/env.ts:89-91
export function isRenderDryRun(): boolean {
  return env.APP_RENDER_DRY_RUN && !env.APP_TEST_MODE;
}
```

### `APP_DRY_RUN_FAIL_STEP`

- **Type:** String (step name)
- **Default:** Empty string
- **Required:** No
- **Description:** Simulate failure at specific render step (for testing error handling)
- **Example:** `APP_DRY_RUN_FAIL_STEP=ffmpeg_render`
- **Valid Steps:** `tts_generate`, `asr_align`, `images_generate`, `captions_build`, `music_build`, `ffmpeg_render`, `finalize_artifacts`
- **Requires:** `APP_RENDER_DRY_RUN=1`

### `APP_DRY_RUN_STEP_DELAY_MS`

- **Type:** Integer (milliseconds)
- **Default:** `0`
- **Required:** No
- **Description:** Artificial delay between dry-run steps (for simulating slow renders)
- **Example:** `APP_DRY_RUN_STEP_DELAY_MS=500`
- **Requires:** `APP_RENDER_DRY_RUN=1`

---

## Optional Variables

### `APP_VERSION`

- **Type:** String
- **Default:** Empty string
- **Required:** No
- **Description:** Application version identifier (for logging/monitoring)
- **Example:** `APP_VERSION=1.0.0`

### `LOG_LEVEL`

- **Type:** String enum: `error` | `warn` | `info` | `debug`
- **Default:** `info`
- **Required:** No
- **Description:** Winston logger level
- **Example:** `LOG_LEVEL=debug`

### `ALLOWED_ORIGINS`

- **Type:** Comma-separated URLs
- **Default:** Empty (allows all origins in development)
- **Required:** Yes (in production)
- **Description:** CORS allowed origins
- **Example:** `ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com`
- **Validation:** Each origin must start with `http://` or `https://`
- **Security:** **Critical** - must be set in production to prevent CORS vulnerabilities

```typescript
// apps/server/src/env.ts:65-68
ALLOWED_ORIGINS:
  process.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter((o) => o.startsWith('http://') || o.startsWith('https://')) || [],
```

---

## Environment-Specific Configuration

### Development

**File:** `.env` (local)

```bash
# .env
NODE_ENV=development
PORT=3001
DATABASE_URL=file:./dev.db
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=

# Paths default to repository root
# MUSIC_LIBRARY_DIR=
# ARTIFACTS_DIR=

# Optional: test modes
# APP_TEST_MODE=0
# APP_RENDER_DRY_RUN=0

# No ALLOWED_ORIGINS needed (development allows all)
```

**Start servers:**

```bash
npm install
npm run dev  # Starts server (3001) and web (5173)
```

### Production

**Platform Environment Variables** (Railway/Heroku/AWS):

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db  # Or file:./production.db
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=

# Required in production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Optional: custom paths
ARTIFACTS_DIR=/app/artifacts
MUSIC_LIBRARY_DIR=/app/assets/music

# Optional: version tracking
APP_VERSION=1.0.0
```

**Build & Start:**

```bash
npm run build
npm run db:migrate
npm start
```

### Docker

**docker-compose.yml:**

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=file:/app/data/prod.db
      - ARTIFACTS_DIR=/app/artifacts
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-}
    volumes:
      - ./data:/app/data
      - ./artifacts:/app/artifacts
```

**Host .env file:**

```bash
# .env (host machine)
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=
ALLOWED_ORIGINS=https://yourdomain.com
```

**Start:**

```bash
docker-compose up -d
```

See [deployment.md](deployment.md) for complete Docker setup.

### Railway.app

**Configuration:**

1. Navigate to **Variables** tab in Railway dashboard
2. Add environment variables:

```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}  # If using Railway Postgres
OPENAI_API_KEY=sk-proj-...
ALLOWED_ORIGINS=https://your-app.railway.app
```

**railway.toml:**

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run db:generate && npm run db:migrate && npm run start"
healthcheckPath = "/api/health"
restartPolicyType = "on_failure"
```

**Deploy:**

```bash
railway up
```

See [deployment.md](deployment.md) for complete Railway setup.

---

## Validation & Defaults

All environment variables are validated in `apps/server/src/env.ts` at startup:

### Type Coercion

```typescript
// Integer parsing with defaults
PORT: parseInt(process.env.PORT || '3001', 10),
APP_DRY_RUN_STEP_DELAY_MS: parseInt(process.env.APP_DRY_RUN_STEP_DELAY_MS || '0', 10),

// Boolean flags (string '1' → true)
APP_TEST_MODE: process.env.APP_TEST_MODE === '1',
APP_RENDER_DRY_RUN: process.env.APP_RENDER_DRY_RUN === '1',

// Array parsing (comma-separated)
ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter((o) => o.startsWith('http://') || o.startsWith('https://')) || [],
```

### Path Resolution

```typescript
// Relative paths resolved from repository root
const rootDir = getRootDir();  // Detects if in apps/server, navigates to root
MUSIC_LIBRARY_DIR: process.env.MUSIC_LIBRARY_DIR || path.resolve(rootDir, 'assets', 'music'),
ARTIFACTS_DIR: process.env.ARTIFACTS_DIR || path.resolve(rootDir, 'artifacts'),
```

### Runtime Validation

```typescript
function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';

  // Production checks
  if (isProduction && !process.env.DATABASE_URL) {
    logBootstrapWarn('DATABASE_URL not set in production. Using default ./dev.db');
  }

  if (isProduction && !isTest && !process.env.OPENAI_API_KEY && !process.env.APP_TEST_MODE) {
    logBootstrapWarn('OPENAI_API_KEY not configured. AI features will not work.');
  }

  // PORT validation
  const port = parseInt(process.env.PORT || '3001', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535.`);
  }
}
```

---

## Security Considerations

### Critical Production Requirements

1. **Set `ALLOWED_ORIGINS`** - Prevents CORS vulnerabilities
2. **Use HTTPS** - Never expose production over HTTP
3. **Protect API Keys** - Never commit `.env` to version control
4. **Secure `ARTIFACTS_DIR`** - Add authentication or move to cloud storage (S3/GCS)
5. **Use PostgreSQL** - SQLite has limitations for production workloads

### Environment Variable Security

```bash
# Bad - committed to git
git add .env

# Good - use .env.example as template
git add .env.example

# Good - platform secrets (Railway/Heroku/AWS)
railway variables set OPENAI_API_KEY=sk-proj-...

# Good - Docker secrets
docker secret create openai_key -
```

### API Key Rotation

```bash
# Rotate keys regularly
1. Generate new OpenAI API key in dashboard
2. Update environment variable
3. Restart service
4. Delete old key from OpenAI dashboard
```

### File System Security

```typescript
// Artifacts are served as static files - add authentication in production
// apps/server/src/index.ts
app.use('/artifacts', authMiddleware, express.static(env.ARTIFACTS_DIR));
```

See [security.md](security.md) for complete security guide.

---

## Helper Functions

The `env.ts` module exports helper functions for checking configuration:

```typescript
import {
  isOpenAIConfigured,
  isElevenLabsConfigured,
  isTestMode,
  isRenderDryRun,
  isProduction,
  isDevelopment,
  isNodeTest,
  getDryRunConfig,
  setDryRunConfig,
  getProviderStatus,
} from './env.js';

// Check if providers are configured
if (!isOpenAIConfigured()) {
  console.error('OpenAI not configured');
}

// Get current environment
if (isProduction()) {
  // Production-specific logic
}

// Get all provider status
const status = getProviderStatus();
// {
//   openai: true,
//   elevenlabs: false,
//   ffmpeg: true,
//   testMode: false,
//   renderDryRun: false
// }

// Dynamically update dry-run config (test routes only)
setDryRunConfig({ failStep: 'ffmpeg_render', stepDelayMs: 500 });
```

---

## Troubleshooting

### Error: Invalid PORT

```
Error: Invalid PORT: abc. Must be between 1 and 65535.
```

**Fix:** Set valid port number in `.env`:

```bash
PORT=3001
```

### Warning: DATABASE_URL not set in production

```
[WARN] DATABASE_URL not set in production. Using default ./dev.db
```

**Fix:** Set explicit `DATABASE_URL`:

```bash
DATABASE_URL=file:./production.db
# Or PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_ai
```

### Warning: OPENAI_API_KEY not configured

```
[WARN] OPENAI_API_KEY not configured. AI features will not work.
```

**Fix:** Add OpenAI API key:

```bash
OPENAI_API_KEY=sk-proj-...
```

### CORS errors in browser console

```
Access to fetch at 'http://localhost:3001/api/projects' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Fix:** In production, set `ALLOWED_ORIGINS`:

```bash
ALLOWED_ORIGINS=https://myapp.com
```

In development, CORS allows all origins by default.

---

## Related Documentation

- [setup.md](setup.md) - Initial setup guide
- [development.md](development.md) - Development workflow
- [deployment.md](deployment.md) - Production deployment
- [security.md](security.md) - Security best practices
- [troubleshooting.md](troubleshooting.md) - Common issues

---

**Last Updated:** 2026-01-29  
**Source Files:** `apps/server/src/env.ts`, `.env.example`
