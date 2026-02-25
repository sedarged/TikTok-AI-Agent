import OpenAI, { APIError } from 'openai';
import { logError, logDebug, logWarn } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import pRetry, { type RetryContext } from 'p-retry';
import { env, isOpenAIConfigured } from '../../env.js';
import { prisma } from '../../db/client.js';
import { getMediaDuration } from '../ffmpeg/ffmpegUtils.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Approximate OpenAI list prices (USD) for cost estimate
const COST = {
  dallE3Standard1024x1792: 0.04,
  tts1PerMillionChars: 15,
  whisperPerMinute: 0.006,
} as const;

const RETRY_OPTIONS = {
  retries: 3,
  minTimeout: 2000,
  onFailedAttempt: (ctx: RetryContext) => {
    logWarn(
      `OpenAI call failed (attempt ${ctx.attemptNumber}/${ctx.attemptNumber + ctx.retriesLeft}): ${ctx.error.message}`
    );
  },
};

function shouldRetry(err: unknown): boolean {
  // Use the SDK's typed APIError for precise status-code detection
  if (err instanceof APIError) {
    if (err.status === 429) return true; // rate limited
    if (err.status === 503 || err.status === 529) return true; // overloaded
    // Treat SDK-level network errors as retryable
    if (err.status == null) return true;
    return false;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnaborted'))
      return true;
    // Fallback string check for non-SDK errors (e.g., wrapped fetch errors)
    if (msg.includes('429') || msg.includes('rate limit')) return true;
  }
  return false;
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI API key not configured');
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

// OpenAI usage stats returned with responses
export interface OpenAIUsageStats {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

// Call OpenAI chat completion (with p-retry on 429/timeout)
export async function callOpenAI(
  prompt: string,
  responseFormat: 'json' | 'text' = 'text',
  model: string = 'gpt-4o-mini'
): Promise<{ content: string; usage: OpenAIUsageStats }> {
  const client = getClient();
  const startTime = Date.now();

  const response = await pRetry(
    async () => {
      return client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              responseFormat === 'json'
                ? 'You are a helpful assistant that always responds with valid JSON only, no markdown.'
                : 'You are a helpful creative assistant for video content creation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
        temperature: 0.8,
        max_tokens: 4000,
      });
    },
    { ...RETRY_OPTIONS, shouldRetry }
  );

  const latencyMs = Date.now() - startTime;
  const content = response.choices[0]?.message?.content || '';
  const usage: OpenAIUsageStats = {
    model,
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    latencyMs,
  };

  return { content, usage };
}

export interface GenerateImageResult {
  path: string;
  estimatedCostUsd: number;
}

// Generate image with DALL-E
export async function generateImage(
  prompt: string,
  outputPath: string,
  size: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1792',
  negativePrompt?: string
): Promise<GenerateImageResult> {
  const client = getClient();

  // Build full prompt with negative prompt appended if provided
  // DALL-E 3 doesn't support negative prompts natively, so we append them to the main prompt
  const trimmedNegativePrompt = negativePrompt?.trim();
  let fullPrompt = prompt;
  if (trimmedNegativePrompt) {
    fullPrompt = `${prompt}. Avoid: ${trimmedNegativePrompt}`;
  }

  // Truncate to DALL-E 3's limit before caching/requesting
  const finalPrompt = fullPrompt.substring(0, 4000);

  // Check cache first (cache key based on exact prompt sent to API)
  const hashKey = createHash('images', finalPrompt, size);
  const cached = await getCachedResult(hashKey);

  if (cached && cached.payloadPath && fs.existsSync(cached.payloadPath)) {
    fs.copyFileSync(cached.payloadPath, outputPath);
    return { path: outputPath, estimatedCostUsd: 0 };
  }

  logDebug(`Generating image: ${finalPrompt.substring(0, 50)}...`);

  const response = await pRetry(
    async () =>
      client.images.generate({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size,
        quality: 'standard',
        response_format: 'url',
      }),
    { ...RETRY_OPTIONS, shouldRetry }
  );

  const imageData = response.data;
  if (!imageData || imageData.length === 0 || !imageData[0].url) {
    throw new Error('No image URL in response');
  }
  const imageUrl = imageData[0].url;

  // Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }

  const buffer = await imageResponse.arrayBuffer();

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, Buffer.from(buffer));

  await cacheResult(hashKey, 'images', { url: imageUrl }, outputPath);

  const estimatedCostUsd = size === '1024x1792' ? COST.dallE3Standard1024x1792 : 0.04;
  return { path: outputPath, estimatedCostUsd };
}

export interface GenerateTTSResult {
  path: string;
  estimatedCostUsd: number;
}

// Generate TTS audio
export async function generateTTS(
  text: string,
  outputPath: string,
  voice: string = 'alloy'
): Promise<GenerateTTSResult> {
  const client = getClient();

  const hashKey = createHash('tts', text, voice);
  const cached = await getCachedResult(hashKey);

  if (cached && cached.payloadPath && fs.existsSync(cached.payloadPath)) {
    fs.copyFileSync(cached.payloadPath, outputPath);
    return { path: outputPath, estimatedCostUsd: 0 };
  }

  logDebug(`Generating TTS: ${text.substring(0, 50)}...`);

  const mp3 = await pRetry(
    async () =>
      client.audio.speech.create({
        model: 'tts-1',
        voice: voice as TTSVoice,
        input: text,
        response_format: 'mp3',
      }),
    { ...RETRY_OPTIONS, shouldRetry }
  );

  const buffer = Buffer.from(await mp3.arrayBuffer());

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);

  await cacheResult(hashKey, 'tts', { voice }, outputPath);

  const estimatedCostUsd = (text.length / 1e6) * COST.tts1PerMillionChars;
  return { path: outputPath, estimatedCostUsd };
}

export interface TranscribeAudioResult {
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
  estimatedCostUsd: number;
}

// Transcribe audio with Whisper
export async function transcribeAudio(audioPath: string): Promise<TranscribeAudioResult> {
  const client = getClient();

  const audioBuffer = fs.readFileSync(audioPath);
  const hashKey = createHash('asr', audioBuffer.toString('base64').substring(0, 1000));
  const cached = await getCachedResult(hashKey);

  if (cached && cached.resultJson) {
    const result = safeJsonParse<TranscribeAudioResult>(cached.resultJson, {
      text: '',
      estimatedCostUsd: 0,
    });
    result.estimatedCostUsd = 0;
    return result;
  }

  logDebug(`Transcribing audio: ${audioPath}`);

  const transcription = await pRetry(
    async () =>
      client.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      }),
    { ...RETRY_OPTIONS, shouldRetry }
  );

  const words = (transcription as { words?: WhisperWord[] }).words;
  let estimatedCostUsd: number;
  try {
    const durationSec = await getMediaDuration(audioPath);
    estimatedCostUsd = (durationSec / 60) * COST.whisperPerMinute;
  } catch {
    // fallback: assume 1 min
    estimatedCostUsd = COST.whisperPerMinute;
  }
  const result: TranscribeAudioResult = {
    text: transcription.text,
    words: words?.map((w) => ({ word: w.word, start: w.start, end: w.end })),
    estimatedCostUsd,
  };

  await cacheResult(hashKey, 'asr', { text: result.text, words: result.words });

  return result;
}

// Cache helpers
export function createHash(...args: string[]): string {
  return crypto.createHash('md5').update(args.join('|')).digest('hex');
}

export async function getCachedResult(hashKey: string) {
  try {
    const cached = await prisma.cache.findUnique({
      where: { hashKey },
    });

    // Check if cache entry has expired
    if (cached?.expiresAt && cached.expiresAt < new Date()) {
      // Cache expired, delete and return null
      await prisma.cache.delete({ where: { hashKey } }).catch(() => {
        // Ignore deletion errors
      });
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

export async function cacheResult(
  hashKey: string,
  kind: string,
  result: unknown,
  payloadPath?: string,
  ttlSeconds?: number
) {
  try {
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    await prisma.cache.upsert({
      where: { hashKey },
      create: {
        hashKey,
        kind,
        resultJson: JSON.stringify(result),
        payloadPath,
        expiresAt,
      },
      update: {
        resultJson: JSON.stringify(result),
        payloadPath,
        expiresAt,
      },
    });
  } catch (error) {
    logError('Failed to cache result:', error);
  }
}
