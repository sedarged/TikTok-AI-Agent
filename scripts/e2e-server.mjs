#!/usr/bin/env node
/**
 * E2E web server launcher: sets env (no cross-env), uses absolute DATABASE_URL, runs migrate then npm run dev.
 * Used by Playwright webServer so the same DB path is used regardless of cwd/shell (Windows-friendly).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const e2eDbPath = path.join(root, 'apps', 'server', 'e2e.db');

process.env.APP_TEST_MODE = '0';
process.env.APP_RENDER_DRY_RUN = '1';
process.env.NODE_ENV = 'e2e';
process.env.DATABASE_URL = `file:${e2eDbPath}`;

// Run migrations from apps/server directory for Prisma 7 config file location
execSync('npx prisma migrate deploy', {
  cwd: path.join(root, 'apps', 'server'),
  stdio: 'inherit',
  env: process.env,
});

// For E2E, use concurrently to run both server and web, but without watch mode for server
// This prevents tsx from restarting the server during tests
const serverCmd = 'cd apps/server && npx tsx src/index.ts';
const webCmd = 'npm run dev:web';
const concurrentlyCmd = `npx concurrently "${serverCmd}" "${webCmd}"`;

const child = spawn(concurrentlyCmd, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
