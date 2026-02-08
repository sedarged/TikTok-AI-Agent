# Test Modes & Environment Variables

**Comprehensive guide for running tests without incurring API costs or requiring external services.**

---

## Overview

The project supports multiple test modes that allow development and testing without:
- Making paid OpenAI API calls
- Requiring FFmpeg installation
- Hitting external services
- Incurring infrastructure costs

---

## Test Mode Environment Variables

### `APP_TEST_MODE=1`

**Purpose:** Mock all external API calls for fast unit testing

**What it does:**
- Mocks OpenAI GPT-4 responses for plan generation
- Mocks OpenAI TTS (text-to-speech) responses
- Mocks OpenAI DALL-E image generation
- Mocks OpenAI Whisper transcription
- Returns fake data structures matching real API responses
- Disables automate endpoint (returns 403)

**When to use:**
- Running unit tests (`npm run test`)
- Fast iteration during development
- CI/CD pipelines to avoid API costs
- Testing validation logic without external dependencies

**Example:**
```bash
APP_TEST_MODE=1 npm run test
```

**Code location:** `apps/server/src/env.ts` - `isTestMode()` function

---

### `APP_RENDER_DRY_RUN=1`

**Purpose:** Run render pipeline without paid APIs but with full FFmpeg operations

**What it does:**
- **Mocks paid OpenAI calls** (TTS, DALL-E, Whisper)
- **Runs actual FFmpeg** operations (requires FFmpeg installed)
- Tests full render pipeline orchestration
- Validates file I/O, directory structure, artifact generation
- Tests caption generation, video composition, thumbnail creation
- Useful for testing render logic without API costs

**When to use:**
- Testing render pipeline (`npm run test:render`)
- Validating FFmpeg integration
- Testing artifact generation and verification
- Debugging render failures without spending money

**Example:**
```bash
APP_RENDER_DRY_RUN=1 npm run test:render
```

**Code location:** `apps/server/src/env.ts` - `isRenderDryRun()` function

---

### `APP_DRY_RUN_FAIL_STEP=<step>`

**Purpose:** Simulate failures at specific render pipeline steps

**What it does:**
- Forces the render pipeline to fail at the specified step
- Useful for testing error handling and recovery
- Tests resume logic and cleanup

**Valid steps:**
- `tts_generate` - Fail during voice-over generation
- `asr_align` - Fail during Whisper transcription
- `images_generate` - Fail during image generation
- `captions_build` - Fail during caption creation
- `music_build` - Fail during background music processing
- `ffmpeg_render` - Fail during video composition
- `finalize_artifacts` - Fail during final artifact verification

**Example:**
```bash
APP_RENDER_DRY_RUN=1 APP_DRY_RUN_FAIL_STEP=images_generate npm run test:render
```

**Use cases:**
- Testing error messages and logging
- Validating cleanup of partial artifacts
- Testing resume-from-failure logic
- Ensuring database state consistency on failure

---

### `NODE_ENV=test`

**Purpose:** Node.js standard test environment indicator

**What it does:**
- Automatically set by test runners (Vitest, Jest)
- Used in combination with other test flags
- Affects logging verbosity, security checks, etc.

**Code location:** Checked via `process.env.NODE_ENV === 'test'`

---

### `NODE_ENV=development`

**Purpose:** Development mode (default for `npm run dev`)

**What it does:**
- Enables hot reload
- More verbose logging
- Relaxed security checks
- Serves artifacts directory statically
- Disables some production-only middleware

---

### `NODE_ENV=production`

**Purpose:** Production mode (for deployment)

**What it does:**
- Stricter security headers
- CORS validation
- Rate limiting enforcement
- No static artifact serving
- Optimized performance

---

## Test Commands

### Unit & Integration Tests

```bash
# Standard test run (with prisma generate)
npm run test

# Skip prisma generate (faster, for Windows EPERM issues)
npm run test:only

# Run specific test file
npm test -- planValidator.test.ts

# Run with coverage
npm test -- --coverage
```

**Internally runs:**
1. Backend tests: `apps/server/tests/**/*.test.ts`
2. SSE tests: `apps/server/tests/runSse.test.ts`

---

### Render Pipeline Tests

```bash
# Full render pipeline dry-run (requires FFmpeg)
npm run test:render

# Skip prisma generate
npm run test:render:only

# Test specific step failure
APP_DRY_RUN_FAIL_STEP=images_generate npm run test:render

# Smoke test (quick validation)
npm run render:smoke
```

**What's tested:**
- Plan generation (mocked)
- All 7 render steps with FFmpeg
- Artifact creation and verification
- Error handling and cleanup

---

### E2E Tests

```bash
# Full E2E test suite (Playwright)
npm run test:e2e

# Run specific E2E test
npx playwright test tests/e2e/create-project.spec.ts

# Debug mode with browser
npx playwright test --debug

# UI mode
npx playwright test --ui
```

**Requirements:**
- Playwright browsers installed: `npx playwright install`
- Dev server running (or starts automatically in CI)

---

## Testing Best Practices

### 1. Always Use Test Modes

**Don't:**
```typescript
// Makes real OpenAI API calls in tests! 💸
const result = await generatePlan(topic);
```

**Do:**
```typescript
// Set APP_TEST_MODE=1 in test setup
// Or use APP_RENDER_DRY_RUN=1 for render tests
```

### 2. Clean Up After Tests

```typescript
// Use afterEach/afterAll to clean up
afterEach(async () => {
  await prisma.project.deleteMany();
  await prisma.run.deleteMany();
});
```

### 3. Use Descriptive Test Names

```typescript
// Good
test('should validate plan and return errors for missing narration', async () => {
  // ...
});

// Bad
test('validation test', async () => {
  // ...
});
```

### 4. Test Error Cases

```typescript
// Test both success and failure paths
test('should handle invalid nichePackId', async () => {
  await expect(generatePlan('topic', 'invalid')).rejects.toThrow();
});
```

---

## Environment Variable Checking

### In Code

```typescript
import { isTestMode, isRenderDryRun, isDevelopment, isProduction } from '../env.js';

if (isTestMode()) {
  // Use mocked responses
  return mockPlanData;
}

if (isRenderDryRun()) {
  // Skip paid APIs but run FFmpeg
  return mockImageUrls;
}
```

### Helper Functions Location

**File:** `apps/server/src/env.ts`

```typescript
export function isTestMode(): boolean;
export function isRenderDryRun(): boolean;
export function isDevelopment(): boolean;
export function isProduction(): boolean;
export function isNodeTest(): boolean;
export function isOpenAIConfigured(): boolean;
```

---

## Test Setup Files

### Backend Test Setup

**File:** `apps/server/tests/setup.ts`

- Sets `APP_TEST_MODE=1` automatically
- Configures test database
- Sets up mock data
- Initializes test environment

### E2E Test Config

**File:** `playwright.config.mjs`

- Configures Playwright
- Sets up dev server
- Defines test timeouts
- Browser configuration

---

## Debugging Tests

### 1. Run Single Test File

```bash
npm test -- planValidator.test.ts
```

### 2. Add Debug Logging

```typescript
import { logInfo, logDebug } from '../utils/logger.js';

test('my test', async () => {
  logDebug('Testing with data:', data);
  // ...
});
```

### 3. Use Vitest UI (if available)

```bash
npx vitest --ui
```

### 4. Check Test Output

```bash
# Verbose output
npm test -- --reporter=verbose

# Watch mode (for TDD)
npm test -- --watch
```

---

## Common Issues

### Issue: Tests calling real APIs

**Symptom:** Tests are slow or you see OpenAI API charges

**Solution:**
1. Check `APP_TEST_MODE=1` is set in test setup
2. Verify `isTestMode()` checks in code
3. Look for direct API calls that bypass environment checks

### Issue: FFmpeg not found in tests

**Symptom:** `render:smoke` or `test:render` fails with FFmpeg error

**Solution:**
1. Install FFmpeg: `apt-get install ffmpeg` (Linux) or `brew install ffmpeg` (macOS)
2. Verify: `ffmpeg -version`
3. Or use `APP_TEST_MODE=1` to mock FFmpeg calls

### Issue: Prisma EPERM on Windows

**Symptom:** Permission denied on Windows when running tests

**Solution:**
```bash
npm run test:only        # Skip prisma generate
npm run test:render:only # Skip prisma generate
```

---

## Test Coverage

### View Coverage Report

```bash
# Generate coverage report
npm test -- --coverage

# Open in browser
open coverage/index.html
```

### Coverage Thresholds

Target coverage (recommended):
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

---

## CI/CD Integration

### GitHub Actions (`.github/workflows/ci.yml`)

```yaml
- name: Run tests
  run: npm run test
  env:
    APP_TEST_MODE: 1
    DATABASE_URL: file:./test.db

- name: Run render tests
  run: npm run test:render
  env:
    APP_RENDER_DRY_RUN: 1
```

**Note:** Test modes are essential for CI/CD to avoid API costs and external dependencies.

---

## Summary

| Mode | Purpose | APIs | FFmpeg | Cost |
|------|---------|------|--------|------|
| `APP_TEST_MODE=1` | Fast unit tests | Mocked | Mocked | Free |
| `APP_RENDER_DRY_RUN=1` | Render tests | Mocked | Real | Free |
| `APP_DRY_RUN_FAIL_STEP` | Failure testing | Mocked | Real | Free |
| Production | Real usage | Real | Real | Paid |

**Best practice:** Always use test modes during development and CI/CD. Only use production mode for actual video generation.

---

## See Also

- [Testing Strategy](../../docs/testing.md) - Comprehensive testing guide
- [Setup Guide](../../docs/setup.md) - Environment setup
- [Common Pitfalls](./common-pitfalls.md) - Common testing mistakes
- [env.ts](../../apps/server/src/env.ts) - Environment variable helpers
