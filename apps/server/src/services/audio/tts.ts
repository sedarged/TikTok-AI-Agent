import fs from 'node:fs';
import path from 'node:path';
import type OpenAI from 'openai';
import { hashKey, putCache, getCache, fileExists, ensureDir } from '../cache/cache.js';

export async function generateTtsSceneAudio(args: {
  client: OpenAI;
  voice: string;
  text: string;
  outPath: string;
}) {
  ensureDir(path.dirname(args.outPath));
  const key = hashKey('tts', { voice: args.voice, text: args.text });
  const cached = await getCache('tts', key);
  if (cached?.payloadPath && fileExists(cached.payloadPath)) {
    if (!fileExists(args.outPath)) fs.copyFileSync(cached.payloadPath, args.outPath);
    return { reused: true, cacheHit: true };
  }
  if (fileExists(args.outPath)) {
    await putCache('tts', key, { ok: true }, args.outPath);
    return { reused: true, cacheHit: false };
  }

  const resp = await args.client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: args.voice as any,
    input: args.text,
    format: 'wav'
  } as any);

  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(args.outPath, buf);
  await putCache('tts', key, { ok: true }, args.outPath);
  return { reused: false, cacheHit: false };
}

