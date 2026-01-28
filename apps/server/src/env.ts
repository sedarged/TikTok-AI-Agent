import "dotenv/config";
import { z } from "zod";
import path from "path";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().optional().default("4000"),
  OPENAI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  MUSIC_LIBRARY_DIR: z.string().optional().default("./assets/music"),
  ARTIFACTS_DIR: z.string().optional().default("./artifacts"),
  DATABASE_URL: z.string().optional().default("file:./dev.db")
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten());
  throw new Error("Invalid environment variables");
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  port: Number(env.PORT),
  openAiKey: env.OPENAI_API_KEY ?? "",
  elevenLabsKey: env.ELEVENLABS_API_KEY ?? "",
  musicLibraryDir: path.resolve(env.MUSIC_LIBRARY_DIR ?? "./assets/music"),
  artifactsDir: path.resolve(env.ARTIFACTS_DIR ?? "./artifacts"),
  databaseUrl: env.DATABASE_URL ?? "file:./dev.db"
};

export const providerStatus = {
  openaiConfigured: Boolean(env.OPENAI_API_KEY),
  elevenlabsConfigured: Boolean(env.ELEVENLABS_API_KEY)
};
