import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: 'apps/web/tests/e2e',
  fullyParallel: false,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: `node "${path.join(__dirname, 'scripts', 'e2e-server.mjs')}"`,
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  workers: 1,
});
