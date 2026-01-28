import OpenAI from 'openai';
import { env, isOpenAIConfigured } from '../../env.js';
import { prisma } from '../../db/client.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

// Call OpenAI chat completion
export async function callOpenAI(
  prompt: string,
  responseFormat: 'json' | 'text' = 'text',
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const client = getClient();
  
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: responseFormat === 'json' 
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

  return response.choices[0]?.message?.content || '';
}

// Generate image with DALL-E
export async function generateImage(
  prompt: string,
  outputPath: string,
  size: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1792'
): Promise<string> {
  const client = getClient();
  
  // Check cache first
  const hashKey = createHash('images', prompt, size);
  const cached = await getCachedResult(hashKey);
  
  if (cached && cached.payloadPath && fs.existsSync(cached.payloadPath)) {
    // Copy cached file to output
    fs.copyFileSync(cached.payloadPath, outputPath);
    return outputPath;
  }

  console.log(`Generating image: ${prompt.substring(0, 50)}...`);

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt: prompt.substring(0, 4000), // DALL-E 3 has prompt limit
    n: 1,
    size,
    quality: 'standard',
    response_format: 'url',
  });

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

  // Cache the result
  await cacheResult(hashKey, 'images', { url: imageUrl }, outputPath);

  return outputPath;
}

// Generate TTS audio
export async function generateTTS(
  text: string,
  outputPath: string,
  voice: string = 'alloy'
): Promise<string> {
  const client = getClient();
  
  // Check cache
  const hashKey = createHash('tts', text, voice);
  const cached = await getCachedResult(hashKey);
  
  if (cached && cached.payloadPath && fs.existsSync(cached.payloadPath)) {
    fs.copyFileSync(cached.payloadPath, outputPath);
    return outputPath;
  }

  console.log(`Generating TTS: ${text.substring(0, 50)}...`);

  const mp3 = await client.audio.speech.create({
    model: 'tts-1',
    voice: voice as any,
    input: text,
    response_format: 'mp3',
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);

  // Cache the result
  await cacheResult(hashKey, 'tts', { voice }, outputPath);

  return outputPath;
}

// Transcribe audio with Whisper
export async function transcribeAudio(
  audioPath: string
): Promise<{ text: string; words?: Array<{ word: string; start: number; end: number }> }> {
  const client = getClient();
  
  // Check cache
  const audioBuffer = fs.readFileSync(audioPath);
  const hashKey = createHash('asr', audioBuffer.toString('base64').substring(0, 1000));
  const cached = await getCachedResult(hashKey);
  
  if (cached && cached.resultJson) {
    const result = JSON.parse(cached.resultJson);
    return result;
  }

  console.log(`Transcribing audio: ${audioPath}`);

  const file = fs.createReadStream(audioPath);
  
  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  });

  const result = {
    text: transcription.text,
    words: (transcription as any).words?.map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
  };

  // Cache the result
  await cacheResult(hashKey, 'asr', result);

  return result;
}

// Cache helpers
function createHash(...args: string[]): string {
  return crypto.createHash('md5').update(args.join('|')).digest('hex');
}

async function getCachedResult(hashKey: string) {
  try {
    return await prisma.cache.findUnique({
      where: { hashKey },
    });
  } catch {
    return null;
  }
}

async function cacheResult(
  hashKey: string,
  kind: string,
  result: any,
  payloadPath?: string
) {
  try {
    await prisma.cache.upsert({
      where: { hashKey },
      create: {
        hashKey,
        kind,
        resultJson: JSON.stringify(result),
        payloadPath,
      },
      update: {
        resultJson: JSON.stringify(result),
        payloadPath,
      },
    });
  } catch (error) {
    console.error('Failed to cache result:', error);
  }
}
