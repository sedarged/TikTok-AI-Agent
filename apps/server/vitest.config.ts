import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    pool: 'threads',
    minThreads: 1,
    maxThreads: 1,
    fileParallelism: false,
  },
  coverage: {
    provider: 'v8',
    include: ['src/**/*.ts'],
    exclude: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts', 'tests/**'],
  },
});
