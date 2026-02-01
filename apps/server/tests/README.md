# Test Suite Documentation

## Overview

This directory contains the test suite for the TikTok-AI-Agent server. Tests are organized into unit tests and integration tests.

## Test Files

### Integration Tests

#### `api.integration.test.ts`
Tests the core API workflow in TEST_MODE (mocked AI responses):
- Project creation and management
- Plan generation and editing
- Scene management and locking
- Plan validation and approval
- Input validation
- Note: `/api/automate` and `/api/batch` endpoints are disabled in TEST_MODE

#### `renderDryRun.integration.test.ts`
Tests the render pipeline in DRY_RUN mode (no actual AI API calls or MP4 generation):
- Complete render pipeline execution
- Scene duration updates based on TTS
- Render failure injection and recovery
- Render cancellation
- `/api/automate` endpoint (one-click create → plan → approve → render)
- `/api/batch` endpoint (batch processing of multiple topics)

#### `automateAndDownload.integration.test.ts` ⭐ NEW
Comprehensive integration tests for automate, batch, download, and verify endpoints:
- **Automate Endpoint Tests**:
  - Complete workflow: create → plan → approve → render → download → verify
  - Input validation (topic length, tempo enum, niche pack)
  - Edge case handling (OpenAI/FFmpeg checks bypassed in dry-run)
  
- **Batch Endpoint Tests**:
  - Multiple topics processing
  - Maximum topics validation
  - Empty array validation (fails as expected)
  - Download/verify for batch-created runs
  
- **Download Endpoint Tests**:
  - Dry-run returns 409 (no MP4 available)
  - Non-existent run returns 404
  - Invalid UUID returns 400
  - Run without artifacts
  
- **Verify Endpoint Tests**:
  - Successful render verification
  - Failed run verification
  - Input validation (UUID format)
  
- **Regression Tests**:
  - Multiple concurrent automate calls
  - Batch with single topic

#### `runSse.integration.test.ts`
Tests Server-Sent Events (SSE) for real-time render progress updates

### Unit Tests

#### `captionsBuilder.unit.test.ts`
Tests caption generation and ASS formatting logic

#### `ffmpegUtils.unit.test.ts`
Tests FFmpeg utility functions (video validation, duration extraction)

#### `planGenerator.unit.test.ts`
Tests AI plan generation with various configurations and edge cases

#### `planValidator.unit.test.ts`
Tests plan validation rules (hooks, outline, scenes, duration)

#### `dbClient.unit.test.ts`
Tests database client initialization and singleton pattern

## Test Modes

### TEST_MODE (APP_TEST_MODE=1)
- Mocks OpenAI API responses
- No actual API calls made
- Fast execution
- Used for: `api.integration.test.ts`, `runSse.integration.test.ts`, unit tests

### DRY_RUN Mode (APP_RENDER_DRY_RUN=1, APP_TEST_MODE=0)
- Simulates full render pipeline
- Creates placeholder files instead of calling external APIs
- Generates dry-run report with simulated metrics
- No MP4 output (returns 409 on download)
- Used for: `renderDryRun.integration.test.ts`, `automateAndDownload.integration.test.ts`

## Running Tests

```bash
# Run all unit and integration tests (TEST_MODE)
npm run test

# Run only specific tests (skip prisma generate)
npm run test:only

# Run render tests (DRY_RUN mode)
npm run test:render

# Run render tests without prisma generate
npm run test:render:only

# Run SSE tests
npm run test:runSse

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Databases

Different test modes use separate SQLite databases:
- `test.db` - Used by TEST_MODE tests
- `test-render.db` - Used by DRY_RUN mode tests
- Databases are automatically migrated before test execution

## Adding New Tests

1. **Integration Tests**: Add to existing `*.integration.test.ts` files or create new ones
   - Use `describeIfDryRun` wrapper for dry-run tests
   - Use `resetDb()` in `beforeEach` to ensure clean state
   - Follow existing patterns for waiting on async operations

2. **Unit Tests**: Create `*.unit.test.ts` files
   - Test pure functions and utilities
   - Mock external dependencies as needed
   - Keep tests fast and isolated

3. **Update package.json**: If creating new test files, add them to appropriate test scripts

## Best Practices

- Always clean up database state in `beforeEach`
- Use `waitForRunStatus()` helper for async render operations
- Validate API responses with Zod schemas where available
- Test both success and error cases
- Test input validation thoroughly
- Use descriptive test names that explain what is being tested

## CI/CD Integration

Tests are automatically run in GitHub Actions:
- On pull requests
- On push to main branch
- Different workflows for different test suites
- Failures block merges

## Troubleshooting

### "Table does not exist" errors
- Ensure migrations are applied: `npm run db:migrate:deploy`
- Check that you're using the correct DATABASE_URL for the test mode

### "Record not found" errors in render tests
- These are expected during cleanup and don't affect test results
- Related to race conditions in render pipeline shutdown

### Tests timing out
- Increase `testTimeout` in `vitest.config.ts` if needed
- Check that `waitForRunStatus` timeout is sufficient for slow operations
