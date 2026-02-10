import dotenv from 'dotenv';
import path from 'path';
import { logBootstrapWarn } from './utils/bootstrapLogger.js';

// Load .env from workspace root - try multiple locations
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', '.env'),
  path.join(process.cwd(), '..', '..', '.env'),
];

for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
}

// Determine root directory for artifacts
function getRootDir(): string {
  // If we're in apps/server, go up two levels
  if (process.cwd().includes('apps/server') || process.cwd().includes('apps\\server')) {
    return path.resolve(process.cwd(), '..', '..');
  }
  return process.cwd();
}

const rootDir = getRootDir();

/**
 * Root directory of the project (repository root).
 * Use this constant instead of process.cwd() for consistent path resolution.
 */
export const ROOT_DIR = rootDir;

// Validate critical environment variables
function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // In production, require explicit DATABASE_URL (not default)
  if (isProduction && !process.env.DATABASE_URL) {
    logBootstrapWarn('DATABASE_URL not set in production. Using default ./dev.db');
  }

  // Warn if OpenAI key is missing in production (unless in test mode)
  if (isProduction && !isTest && !process.env.OPENAI_API_KEY && !process.env.APP_TEST_MODE) {
    logBootstrapWarn('OPENAI_API_KEY not configured. AI features will not work.');
  }

  // Require API_KEY in production for security
  if (isProduction && !isTest && !process.env.API_KEY) {
    throw new Error('API_KEY is required in production. Generate one with: openssl rand -hex 32');
  }

  // Validate PORT is a valid number
  const port = parseInt(process.env.PORT || '3001', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535.`);
  }

  // Validate DATABASE_CONNECTION_LIMIT if provided
  if (process.env.DATABASE_CONNECTION_LIMIT) {
    const limit = parseInt(process.env.DATABASE_CONNECTION_LIMIT, 10);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      throw new Error(
        `Invalid DATABASE_CONNECTION_LIMIT: ${process.env.DATABASE_CONNECTION_LIMIT}. Must be an integer between 1 and 1000.`
      );
    }
  }

  // Validate DATABASE_POOL_TIMEOUT if provided
  if (process.env.DATABASE_POOL_TIMEOUT) {
    const timeout = parseInt(process.env.DATABASE_POOL_TIMEOUT, 10);
    if (isNaN(timeout) || timeout < 1 || timeout > 600) {
      throw new Error(
        `Invalid DATABASE_POOL_TIMEOUT: ${process.env.DATABASE_POOL_TIMEOUT}. Must be an integer between 1 and 600.`
      );
    }
  }
}

validateEnv();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  DATABASE_CONNECTION_LIMIT: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10', 10),
  DATABASE_POOL_TIMEOUT: parseInt(process.env.DATABASE_POOL_TIMEOUT || '10', 10),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  MUSIC_LIBRARY_DIR: process.env.MUSIC_LIBRARY_DIR || path.resolve(rootDir, 'assets', 'music'),
  ARTIFACTS_DIR: process.env.ARTIFACTS_DIR || path.resolve(rootDir, 'artifacts'),
  APP_TEST_MODE: process.env.APP_TEST_MODE === '1',
  APP_RENDER_DRY_RUN: process.env.APP_RENDER_DRY_RUN === '1',
  APP_DRY_RUN_FAIL_STEP: process.env.APP_DRY_RUN_FAIL_STEP || '',
  APP_DRY_RUN_STEP_DELAY_MS: parseInt(process.env.APP_DRY_RUN_STEP_DELAY_MS || '0', 10),
  APP_VERSION: process.env.APP_VERSION || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  API_KEY: process.env.API_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter((o) => o.startsWith('http://') || o.startsWith('https://')) || [],
};

export function isOpenAIConfigured(): boolean {
  if (env.APP_TEST_MODE) {
    return false;
  }
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0);
}

export function isElevenLabsConfigured(): boolean {
  if (env.APP_TEST_MODE) {
    return false;
  }
  return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY.trim().length > 0);
}

export function isTestMode(): boolean {
  return env.APP_TEST_MODE;
}

export function isRenderDryRun(): boolean {
  return env.APP_RENDER_DRY_RUN && !env.APP_TEST_MODE;
}

export function getDryRunFailStep(): string {
  return process.env.APP_DRY_RUN_FAIL_STEP || env.APP_DRY_RUN_FAIL_STEP;
}

export function getDryRunStepDelayMs(): number {
  const raw = process.env.APP_DRY_RUN_STEP_DELAY_MS;
  const parsed = raw ? parseInt(raw, 10) : env.APP_DRY_RUN_STEP_DELAY_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getProviderStatus() {
  return {
    openai: isOpenAIConfigured(),
    elevenlabs: isElevenLabsConfigured(),
    ffmpeg: !env.APP_TEST_MODE && !env.APP_RENDER_DRY_RUN, // Will be checked at runtime
    testMode: env.APP_TEST_MODE,
    renderDryRun: env.APP_RENDER_DRY_RUN,
  };
}

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

export function isNodeTest(): boolean {
  return env.NODE_ENV === 'test';
}

/**
 * Get current dry run configuration dynamically.
 * This reads from process.env to support runtime updates in test routes.
 */
export function getDryRunConfig() {
  const failStep = process.env.APP_DRY_RUN_FAIL_STEP || '';
  const rawDelay = process.env.APP_DRY_RUN_STEP_DELAY_MS || '0';
  const delay = Number.isFinite(parseInt(rawDelay, 10)) ? parseInt(rawDelay, 10) : 0;
  return {
    failStep,
    stepDelayMs: Math.max(0, delay),
  };
}

/**
 * Update dry run configuration at runtime.
 * Used by test routes to dynamically configure render pipeline behavior.
 */
export function setDryRunConfig(config: { failStep?: string; stepDelayMs?: number }): void {
  if (config.failStep !== undefined) {
    process.env.APP_DRY_RUN_FAIL_STEP = config.failStep;
  }
  if (config.stepDelayMs !== undefined) {
    process.env.APP_DRY_RUN_STEP_DELAY_MS = String(config.stepDelayMs);
  }
}
