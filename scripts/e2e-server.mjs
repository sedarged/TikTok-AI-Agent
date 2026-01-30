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

execSync('npx prisma migrate deploy --schema apps/server/prisma/schema.prisma', {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

const child = spawn('npm', ['run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
