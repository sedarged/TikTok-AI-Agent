import fs from 'node:fs';
import path from 'node:path';
import type OpenAI from 'openai';
import sharp from 'sharp';
import { ensureDir, fileExists, getCache, hashKey, putCache } from '../cache/cache.js';

export async function generateSceneImage(args: {
  client: OpenAI;
  prompt: string;
  outPath: string;
  allowProceduralFallback: boolean;
  proceduralText: string;
}) {
  ensureDir(path.dirname(args.outPath));
  const key = hashKey('images', { prompt: args.prompt });
  const cached = await getCache('images', key);
  if (cached?.payloadPath && fileExists(cached.payloadPath)) {
    if (!fileExists(args.outPath)) fs.copyFileSync(cached.payloadPath, args.outPath);
    return { reused: true, cacheHit: true, fallback: false };
  }
  if (fileExists(args.outPath)) {
    await putCache('images', key, { ok: true }, args.outPath);
    return { reused: true, cacheHit: false, fallback: false };
  }

  try {
    const resp = await args.client.images.generate({
      model: 'gpt-image-1',
      size: '1024x1792',
      prompt: args.prompt
    } as any);

    const b64 = (resp as any)?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI images.generate returned no b64_json.');
    fs.writeFileSync(args.outPath, Buffer.from(b64, 'base64'));
    await putCache('images', key, { ok: true }, args.outPath);
    return { reused: false, cacheHit: false, fallback: false };
  } catch (e) {
    if (!args.allowProceduralFallback) throw e;
    await proceduralFallback(args.outPath, args.proceduralText);
    return { reused: false, cacheHit: false, fallback: true };
  }
}

async function proceduralFallback(outPath: string, title: string) {
  const w = 1080;
  const h = 1920;
  const bg = sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 12, g: 12, b: 16 }
    }
  });
  const gradient = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${w * 0.72}" cy="${h * 0.28}" r="${w * 0.28}" fill="#22c55e" opacity="0.12"/>
      <circle cx="${w * 0.22}" cy="${h * 0.72}" r="${w * 0.33}" fill="#a855f7" opacity="0.10"/>
      <text x="50%" y="52%" text-anchor="middle" font-family="Arial Black, Arial" font-size="72" fill="#f8fafc">
        ${escapeXml(title.slice(0, 40))}
      </text>
    </svg>`
  );
  await bg.composite([{ input: gradient }]).png().toFile(outPath);
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

