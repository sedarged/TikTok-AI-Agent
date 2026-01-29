import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'apps/web/tests/e2e',
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    // Use an explicit DB file path so the migration step and the dev server
    // (which may start with a different cwd) always point to the same SQLite DB.
    command: 'cross-env APP_TEST_MODE=0 APP_RENDER_DRY_RUN=1 NODE_ENV=test DATABASE_URL=file:./apps/server/e2e.db npx prisma migrate deploy --schema apps/server/prisma/schema.prisma && cross-env APP_TEST_MODE=0 APP_RENDER_DRY_RUN=1 NODE_ENV=test DATABASE_URL=file:./apps/server/e2e.db npm run dev',
    url: 'http://localhost:5173',
    // Avoid accidentally reusing a dev server from a different worktree.
    reuseExistingServer: false,
    timeout: 120_000,
  },
  workers: 1,
});
