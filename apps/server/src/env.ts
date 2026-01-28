import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load env from both repo root and apps/server (root takes priority if already set).
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().default(5179),

  OPENAI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  MUSIC_LIBRARY_DIR: z.string().default(path.join(repoRoot, 'assets', 'music')),
  ARTIFACTS_DIR: z.string().default(path.join(repoRoot, 'artifacts')),

  DATABASE_URL: z.string().default('file:./dev.db')
});

export type AppEnv = z.infer<typeof EnvSchema>;

const parsed: AppEnv = EnvSchema.parse(process.env);
export const env: AppEnv = {
  ...parsed,
  MUSIC_LIBRARY_DIR: path.isAbsolute(parsed.MUSIC_LIBRARY_DIR) ? parsed.MUSIC_LIBRARY_DIR : path.resolve(repoRoot, parsed.MUSIC_LIBRARY_DIR),
  ARTIFACTS_DIR: path.isAbsolute(parsed.ARTIFACTS_DIR) ? parsed.ARTIFACTS_DIR : path.resolve(repoRoot, parsed.ARTIFACTS_DIR)
};

export const providerStatus = {
  openai: Boolean(env.OPENAI_API_KEY),
  elevenlabs: Boolean(env.ELEVENLABS_API_KEY)
} as const;

