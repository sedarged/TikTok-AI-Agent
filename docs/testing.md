# Testing Guide

Comprehensive testing guide for TikTok-AI-Agent covering unit tests, integration tests, E2E tests, and test modes.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Test Suite Overview](#test-suite-overview)
- [Test Modes](#test-modes)
- [Running Tests](#running-tests)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [E2E Tests](#e2e-tests)
- [Writing Tests](#writing-tests)
- [Mocking Strategies](#mocking-strategies)
- [Coverage](#coverage)
- [CI Test Matrix](#ci-test-matrix)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference

```bash
# Unit Tests (Vitest + mocked OpenAI)
npm run test                 # All unit + integration tests
npm run test:only            # Skip Prisma generate (Windows EPERM fix)

# Render Pipeline Tests (dry-run, no real API calls)
npm run test:render          # Render pipeline validation
npm run test:render:only     # Skip Prisma generate

# E2E Tests (Playwright, real API calls)
npm run test:e2e             # Full E2E test suite

# Smoke Test (single real render)
npm run render:smoke         # Real OpenAI/FFmpeg render

# Coverage
npm run test -- --coverage   # Generate coverage report
```

---

## Test Suite Overview

### Test Architecture

```
TikTok-AI-Agent/
├── apps/server/tests/             # Backend tests (Vitest + Supertest)
│   ├── setup.ts                   # Global test configuration
│   ├── *.unit.test.ts             # Unit tests (mocked dependencies)
│   ├── *.integration.test.ts      # Integration tests (real database)
│   └── vitest.config.ts
├── apps/web/tests/
│   └── e2e/                       # E2E tests (Playwright)
│       ├── quickCreate.spec.ts
│       └── planStudio.spec.ts
└── playwright.config.mjs          # Playwright configuration
```

### Test Files

| File | Type | Lines | Description |
|------|------|-------|-------------|
| `captionsBuilder.unit.test.ts` | Unit | ~150 | ASS subtitle generation tests |
| `ffmpegUtils.unit.test.ts` | Unit | ~200 | FFmpeg utility function tests |
| `planGenerator.unit.test.ts` | Unit | ~180 | AI plan generation (mocked) |
| `planValidator.unit.test.ts` | Unit | ~120 | Plan validation logic |
| `api.integration.test.ts` | Integration | ~300 | API endpoint tests (Supertest) |
| `renderDryRun.integration.test.ts` | Integration | ~250 | Render pipeline dry-run |
| `runSse.integration.test.ts` | Integration | ~200 | Server-Sent Events streaming |
| `apps/web/tests/e2e/*.spec.ts` | E2E | ~400 | Playwright browser tests |

---

## Test Modes

### `APP_TEST_MODE=1` (Unit Tests)

**Purpose:** Fast, deterministic tests without external API calls

**Behavior:**
- OpenAI calls return deterministic mock data
- No real HTTP requests to external services
- Used by default in `npm run test`

**Configuration:**

```typescript
// apps/server/tests/setup.ts
process.env.APP_TEST_MODE ??= '1';
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'file:./test.db';
process.env.OPENAI_API_KEY ??= '';
```

**Example Mock:**

```typescript
// apps/server/src/services/providers/openai.ts
export async function generateTTS(text: string): Promise<string> {
  if (isTestMode()) {
    // Return mock file path
    return '/tmp/mock-audio.mp3';
  }
  // Real OpenAI TTS call
  const response = await client.audio.speech.create({ /* ... */ });
  return response.body;
}
```

### `APP_RENDER_DRY_RUN=1` (Integration Tests)

**Purpose:** Validate render pipeline orchestration without paid API calls

**Behavior:**
- Runs full 7-step render pipeline
- Outputs empty files (no real video/audio/images)
- Validates step ordering, error handling, state management
- Used by `npm run test:render`

**Configuration:**

```bash
# Set in test script
APP_RENDER_DRY_RUN=1 npm run test:render
```

**Step Behavior:**

| Step | Dry-Run Output |
|------|----------------|
| `tts_generate` | Creates empty `.mp3` file |
| `asr_align` | Returns mock word timings |
| `images_generate` | Creates empty `.png` files |
| `captions_build` | Writes empty `.ass` file |
| `music_build` | Creates empty music file |
| `ffmpeg_render` | Creates empty `.mp4` file |
| `finalize_artifacts` | Validates empty files |

### `APP_DRY_RUN_FAIL_STEP=<step>` (Error Testing)

**Purpose:** Simulate failures at specific render steps

**Usage:**

```bash
APP_RENDER_DRY_RUN=1 APP_DRY_RUN_FAIL_STEP=ffmpeg_render npm run test:render
```

**Valid Steps:**
- `tts_generate`
- `asr_align`
- `images_generate`
- `captions_build`
- `music_build`
- `ffmpeg_render`
- `finalize_artifacts`

**Example Test:**

```typescript
// apps/server/tests/renderDryRun.integration.test.ts
describe('Render Pipeline Error Handling', () => {
  it('should handle FFmpeg failure gracefully', async () => {
    process.env.APP_DRY_RUN_FAIL_STEP = 'ffmpeg_render';

    const run = await createTestRun();
    await executePipeline(run);

    const updatedRun = await prisma.run.findUnique({ where: { id: run.id } });
    expect(updatedRun.status).toBe('failed');
    expect(updatedRun.currentStep).toBe('ffmpeg_render');
    expect(JSON.parse(updatedRun.logsJson)).toContainEqual(
      expect.objectContaining({ level: 'error', step: 'ffmpeg_render' })
    );
  });
});
```

---

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit + integration tests
npm run test

# Watch mode (re-run on file changes)
npm run test -- --watch

# Run specific file
npm run test -- captionsBuilder.unit.test.ts

# Run tests matching pattern
npm run test -- --grep "caption"

# With coverage
npm run test -- --coverage
```

**Output:**

```
✓ apps/server/tests/captionsBuilder.unit.test.ts (15)
✓ apps/server/tests/planGenerator.unit.test.ts (12)
✓ apps/server/tests/api.integration.test.ts (28)

Test Files  7 passed (7)
Tests  82 passed (82)
Duration  3.21s
```

### Render Pipeline Tests

```bash
# Full render pipeline dry-run
npm run test:render

# With verbose logging
APP_LOG_LEVEL=debug npm run test:render

# Simulate failure at specific step
APP_DRY_RUN_FAIL_STEP=images_generate npm run test:render
```

**Output:**

```
✓ Render Pipeline Dry-Run Tests
  ✓ should complete all 7 steps (5000ms)
  ✓ should handle step failures (3000ms)
  ✓ should resume from last completed step (4000ms)

Test Files  1 passed (1)
Tests  3 passed (3)
Duration  12.5s
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (show browser)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- quickCreate.spec.ts

# Debug mode (pause on failures)
npm run test:e2e -- --debug

# Generate HTML report
npm run test:e2e -- --reporter=html
```

**Configuration:**

```javascript
// playwright.config.mjs
export default defineConfig({
  testDir: 'apps/web/tests/e2e',
  timeout: 90_000,                    // 90s per test
  retries: process.env.CI ? 1 : 0,    // Retry once in CI
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:5173/api/health',
    reuseExistingServer: !process.env.CI,  // Reuse local dev server
    timeout: 120_000,
  },
  workers: 1,  // Serial execution (render queue allows only 1 concurrent)
});
```

**Output:**

```
Running 4 tests using 1 worker

✓  quickCreate.spec.ts:5:1 › creates project and generates plan (45s)
✓  planStudio.spec.ts:8:1 › edits scene and saves changes (32s)
✓  renderQueue.spec.ts:10:1 › renders video with SSE progress (78s)
✓  output.spec.ts:7:1 › displays final video player (15s)

4 passed (170s)
```

---

## Unit Tests

### Test Structure (Vitest)

```typescript
// apps/server/tests/captionsBuilder.unit.test.ts
import { describe, it, expect } from 'vitest';
import { buildCaptionsFromWords } from '../src/services/captions/captionsBuilder';

describe('Caption Builder', () => {
  it('should generate ASS format captions from word timings', () => {
    const words = [
      { word: 'Hello', start: 0.0, end: 0.5 },
      { word: 'world', start: 0.6, end: 1.2 },
    ];

    const result = buildCaptionsFromWords(words, captionStyle, '/tmp/output.ass');

    expect(result).toContain('[Script Info]');
    expect(result).toContain('[V4+ Styles]');
    expect(result).toMatch(/Dialogue:.*Hello/);
  });

  it('should group words by pauses', () => {
    const words = [
      { word: 'First', start: 0.0, end: 0.3 },
      { word: 'sentence', start: 0.4, end: 0.8 },
      // 0.5s pause
      { word: 'Second', start: 1.3, end: 1.6 },
      { word: 'sentence', start: 1.7, end: 2.0 },
    ];

    const segments = groupWordsByPause(words);

    expect(segments).toHaveLength(2);
    expect(segments[0].words).toHaveLength(2);
    expect(segments[1].words).toHaveLength(2);
  });
});
```

### Mocked Dependencies

```typescript
// Mock Prisma
import { vi } from 'vitest';

vi.mock('../src/db/client', () => ({
  prisma: {
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock OpenAI (already mocked via APP_TEST_MODE)
import { generatePlan } from '../src/services/plan/planGenerator';

describe('Plan Generator', () => {
  it('should return deterministic plan in test mode', async () => {
    const plan = await generatePlan({ topic: 'test', nichePackId: 'horror' });

    expect(plan.hookOptions).toHaveLength(5);
    expect(plan.scenes).toHaveLength(6);
    expect(plan.scriptFull).toContain('test');
  });
});
```

---

## Integration Tests

### API Tests (Supertest)

```typescript
// apps/server/tests/api.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Project API', () => {
  it('POST /api/projects - creates new project', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({
        topic: '5 haunted houses',
        nichePackId: 'horror',
        targetLengthSec: 60,
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.topic).toBe('5 haunted houses');
    expect(response.body.status).toBe('DRAFT_PLAN');
  });

  it('POST /api/projects - validates input', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({
        topic: '',  // Invalid: empty string
        nichePackId: 'horror',
      })
      .expect(400);

    expect(response.body.error).toBe('Invalid project payload');
    expect(response.body.details).toBeDefined();
  });

  it('GET /api/projects/:id - returns project with relations', async () => {
    const project = await createTestProject();

    const response = await request(app)
      .get(`/api/projects/${project.id}`)
      .expect(200);

    expect(response.body).toHaveProperty('planVersions');
    expect(response.body).toHaveProperty('runs');
  });
});
```

### SSE Streaming Tests

```typescript
// apps/server/tests/runSse.integration.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Run SSE Streaming', () => {
  it('should stream render progress updates', async (done) => {
    const run = await createTestRun();
    const events: any[] = [];

    const req = request(app)
      .get(`/api/run/${run.id}/stream`)
      .set('Accept', 'text/event-stream')
      .buffer(false);

    req.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          events.push(data);

          if (data.type === 'complete') {
            expect(events).toContainEqual(
              expect.objectContaining({ type: 'progress', step: 'tts_generate' })
            );
            expect(data.finalStatus).toBe('done');
            req.abort();
            done();
          }
        }
      }
    });

    // Trigger render in parallel
    await executePipeline(run);
  });
});
```

---

## E2E Tests

### Playwright Test Structure

```typescript
// apps/web/tests/e2e/quickCreate.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Quick Create', () => {
  test('creates project and generates plan', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Fill form
    await page.fill('input[name="topic"]', '5 scariest haunted asylums');
    await page.selectOption('select[name="nichePackId"]', 'horror');
    await page.fill('input[name="targetLengthSec"]', '60');

    // Submit
    await page.click('button:has-text("Generate Video Plan")');

    // Wait for plan generation (can take 10-30s)
    await expect(page.locator('text=Plan Generated')).toBeVisible({ timeout: 40_000 });

    // Verify plan details
    await expect(page.locator('[data-testid="hook-options"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="scene-card"]')).toHaveCount.greaterThan(4);
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Generate Video Plan")');

    await expect(page.locator('text=Topic is required')).toBeVisible();
  });
});
```

### Page Object Pattern

```typescript
// apps/web/tests/e2e/pages/PlanStudioPage.ts
export class PlanStudioPage {
  constructor(private page: Page) {}

  async goto(projectId: string) {
    await this.page.goto(`/plan/${projectId}`);
  }

  async selectHook(index: number) {
    await this.page.click(`[data-testid="hook-option-${index}"]`);
  }

  async editScene(sceneIdx: number, narration: string) {
    await this.page.click(`[data-testid="scene-${sceneIdx}"]`);
    await this.page.fill('[name="narrationText"]', narration);
    await this.page.click('button:has-text("Save")');
  }

  async approvePlan() {
    await this.page.click('button:has-text("Approve Plan")');
  }
}

// Usage
test('edits scene in Plan Studio', async ({ page }) => {
  const planStudio = new PlanStudioPage(page);
  await planStudio.goto(projectId);
  await planStudio.editScene(0, 'New narration text');
  await planStudio.approvePlan();
});
```

---

## Writing Tests

### Test Best Practices

**1. Use descriptive test names:**

```typescript
// ✅ Good
it('should return 400 when topic exceeds 500 characters', async () => {});

// ❌ Bad
it('validation test', async () => {});
```

**2. Follow Arrange-Act-Assert pattern:**

```typescript
it('should create project with valid input', async () => {
  // Arrange
  const projectData = {
    topic: 'Test topic',
    nichePackId: 'horror',
  };

  // Act
  const response = await request(app).post('/api/projects').send(projectData);

  // Assert
  expect(response.status).toBe(201);
  expect(response.body.topic).toBe('Test topic');
});
```

**3. Test one thing at a time:**

```typescript
// ✅ Good - separate tests for each validation
it('should reject empty topic', async () => { /* ... */ });
it('should reject topic over 500 chars', async () => { /* ... */ });
it('should reject invalid nichePackId', async () => { /* ... */ });

// ❌ Bad - testing multiple validations in one test
it('should validate all fields', async () => { /* ... */ });
```

**4. Use test fixtures:**

```typescript
// apps/server/tests/fixtures.ts
export async function createTestProject(overrides = {}) {
  return prisma.project.create({
    data: {
      topic: 'Test topic',
      nichePackId: 'horror',
      targetLengthSec: 60,
      ...overrides,
    },
  });
}

// Usage
it('should update project', async () => {
  const project = await createTestProject({ topic: 'Original' });
  // ... test update
});
```

---

## Mocking Strategies

### OpenAI Mocking (Test Mode)

```typescript
// apps/server/src/services/providers/openai.ts
import { isTestMode } from '../../env';

export async function generateTTS(text: string, voice: string): Promise<Buffer> {
  if (isTestMode()) {
    // Return mock audio buffer
    return Buffer.from('mock-audio-data');
  }

  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
  });

  return Buffer.from(await response.arrayBuffer());
}
```

### FFmpeg Mocking (Dry-Run Mode)

```typescript
// apps/server/src/services/ffmpeg/ffmpegUtils.ts
import { isRenderDryRun } from '../../env';

export async function createSceneVideo(options: SceneVideoOptions): Promise<string> {
  if (isRenderDryRun()) {
    // Write empty file
    await fs.writeFile(options.outputPath, '');
    return options.outputPath;
  }

  // Real FFmpeg execution
  const args = buildFFmpegArgs(options);
  await execWithTimeout(`ffmpeg ${args.join(' ')}`, 300_000);
  return options.outputPath;
}
```

### Database Mocking

```typescript
// Use in-memory SQLite for tests
import { vi } from 'vitest';

// Option 1: Mock Prisma client
vi.mock('../src/db/client', () => ({
  prisma: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Option 2: Use real test database (preferred)
// apps/server/tests/setup.ts
process.env.DATABASE_URL = 'file:./test.db';

beforeEach(async () => {
  // Clear test database before each test
  await prisma.project.deleteMany();
  await prisma.run.deleteMany();
});
```

---

## Coverage

### Generate Coverage Report

```bash
npm run test -- --coverage
```

**Output:**

```
File                                  | % Stmts | % Branch | % Funcs | % Lines
--------------------------------------|---------|----------|---------|--------
All files                             |   78.45 |    65.23 |   72.10 |   79.32
 routes                               |   85.12 |    70.45 |   80.00 |   86.23
  project.ts                          |   92.34 |    78.56 |   90.00 |   93.12
  run.ts                              |   88.67 |    72.34 |   85.00 |   89.45
 services                             |   75.23 |    60.12 |   68.90 |   76.45
  renderPipeline.ts                   |   82.45 |    68.90 |   75.00 |   83.67
```

### View HTML Coverage Report

```bash
npm run test -- --coverage --reporter=html
open coverage/index.html
```

### Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

---

## CI Test Matrix

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [20.19.0, 22.12.0]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install FFmpeg
        run: |
          if [ "$RUNNER_OS" == "Linux" ]; then
            sudo apt-get update
            sudo apt-get install -y ffmpeg
          elif [ "$RUNNER_OS" == "macOS" ]; then
            brew install ffmpeg
          elif [ "$RUNNER_OS" == "Windows" ]; then
            choco install ffmpeg
          fi

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test

      - name: Run render tests
        run: npm run test:render

      - name: Run E2E tests
        run: npm run test:e2e
```

---

## Troubleshooting

### Test Hangs Forever

**Cause:** SSE connection not closed, database locked

**Fix:**

```typescript
// Always close connections in afterEach
afterEach(async () => {
  await prisma.$disconnect();
});

// Abort SSE requests
req.on('close', () => {
  connections.delete(res);
});
```

### EPERM Errors on Windows

**Cause:** Prisma file locking during generation

**Fix:**

```bash
# Use :only variants
npm run test:only
npm run test:render:only

# Or manually generate first
npm run db:generate
npm run test:only
```

For Windows-specific testing information, all details have been integrated into this guide (see sections on EPERM errors and Windows troubleshooting above).

### E2E Tests Timeout

**Cause:** Slow plan generation (10-30s), render queue serialization

**Fix:**

```typescript
// Increase timeout in test
test('slow operation', async ({ page }) => {
  test.setTimeout(120_000);  // 2 minutes
  await page.waitForSelector('[data-testid="result"]', { timeout: 60_000 });
});
```

### Mock Data Not Returned

**Cause:** `APP_TEST_MODE` not set

**Fix:**

```typescript
// Verify in test file
import { isTestMode } from '../src/env';
console.log('Test mode:', isTestMode());  // Should be true

// Or set manually
process.env.APP_TEST_MODE = '1';
```

---

## Related Documentation

- [development.md](development.md) - Development workflow
- [configuration.md](configuration.md) - Environment variables
- [troubleshooting.md](troubleshooting.md) - Common issues

---

**Last Updated:** 2026-02-06  
**Test Framework:** Vitest 1.x, Playwright 1.58.0, Supertest 6.x
