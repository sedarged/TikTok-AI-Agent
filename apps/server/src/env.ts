import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root
const rootDir = path.resolve(process.cwd(), '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });
// Also try loading from current directory and parent
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '..', '..', '.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  MUSIC_LIBRARY_DIR: process.env.MUSIC_LIBRARY_DIR || path.join(rootDir, 'assets', 'music'),
  ARTIFACTS_DIR: process.env.ARTIFACTS_DIR || path.join(rootDir, 'artifacts'),
};

export function isOpenAIConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0);
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY.trim().length > 0);
}

export function getProviderStatus() {
  return {
    openai: isOpenAIConfigured(),
    elevenlabs: isElevenLabsConfigured(),
    ffmpeg: true, // Will be checked at runtime
  };
}
