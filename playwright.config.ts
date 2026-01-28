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
    command: 'APP_TEST_MODE=0 APP_RENDER_DRY_RUN=1 NODE_ENV=test DATABASE_URL=file:./e2e.db npm run db:migrate && APP_TEST_MODE=0 APP_RENDER_DRY_RUN=1 NODE_ENV=test DATABASE_URL=file:./e2e.db npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  workers: 1,
});
