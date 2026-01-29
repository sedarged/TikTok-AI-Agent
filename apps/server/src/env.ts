import dotenv from 'dotenv';
import path from 'path';

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

// Validate critical environment variables
function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  
  // In production, require explicit DATABASE_URL (not default)
  if (isProduction && !process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL not set in production. Using default ./dev.db');
  }
  
  // Warn if OpenAI key is missing in production (unless in test mode)
  if (isProduction && !isTest && !process.env.OPENAI_API_KEY && !process.env.APP_TEST_MODE) {
    console.warn('WARNING: OPENAI_API_KEY not configured. AI features will not work.');
  }
  
  // Validate PORT is a valid number
  const port = parseInt(process.env.PORT || '3001', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535.`);
  }
}

validateEnv();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  MUSIC_LIBRARY_DIR: process.env.MUSIC_LIBRARY_DIR || path.resolve(rootDir, 'assets', 'music'),
  ARTIFACTS_DIR: process.env.ARTIFACTS_DIR || path.resolve(rootDir, 'artifacts'),
  APP_TEST_MODE: process.env.APP_TEST_MODE === '1',
  APP_RENDER_DRY_RUN: process.env.APP_RENDER_DRY_RUN === '1',
  APP_DRY_RUN_FAIL_STEP: process.env.APP_DRY_RUN_FAIL_STEP || '',
  APP_DRY_RUN_STEP_DELAY_MS: parseInt(process.env.APP_DRY_RUN_STEP_DELAY_MS || '0', 10),
  APP_VERSION: process.env.APP_VERSION || '',
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
