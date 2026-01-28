import dotenv from 'dotenv';
import path from 'path';

// Load from root .env if not found locally
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const env = {
  PORT: process.env.PORT || 3000,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  MUSIC_LIBRARY_DIR: process.env.MUSIC_LIBRARY_DIR || './assets/music',
  ARTIFACTS_DIR: process.env.ARTIFACTS_DIR || './artifacts',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
};
