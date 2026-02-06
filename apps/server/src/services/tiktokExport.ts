import { callOpenAI } from './providers/openai.js';
import { getNichePack } from './nichePacks.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export interface TikTokMeta {
  caption: string;
  hashtags: string[];
  title: string;
}

/**
 * Generate TikTok-ready metadata (caption, hashtags, title) from topic, niche, hook and outline.
 */
export async function generateTikTokMeta(params: {
  topic: string;
  nichePackId: string;
  hookSelected: string | null;
  outline: string | null;
}): Promise<TikTokMeta> {
  const { topic, nichePackId, hookSelected, outline } = params;
  const niche = getNichePack(nichePackId);
  const nicheName = niche?.name ?? nichePackId;
  const hook = hookSelected?.trim() || '—';
  const outlineText = outline?.trim() || '—';

  const prompt = `You are a TikTok content strategist. Given the following video context, produce exactly three outputs in valid JSON only (no markdown, no extra text):
1. "caption" – A short, engaging TikTok caption (1–2 sentences, max ~150 chars). Include a hook or call-to-action. No hashtags inside the caption.
2. "hashtags" – An array of 5–10 hashtag strings (without #). Mix niche-specific and broad reach (e.g. #fyp #viral plus topic tags). Use camelCase or lowercase.
3. "title" – A concise video title for the creator (max ~60 chars), suitable for YouTube Shorts or reposts.

Context:
- Topic: ${topic}
- Niche / channel style: ${nicheName}
- Hook (first line): ${hook}
- Outline: ${outlineText}

Return only a JSON object with keys: "caption", "hashtags", "title".`;

  const raw = await callOpenAI(prompt, 'json');
  const parsed = safeJsonParse<{ caption?: string; hashtags?: string[]; title?: string }>(raw, {
    caption: topic,
    hashtags: [],
    title: topic,
  });

  const caption = typeof parsed.caption === 'string' ? parsed.caption : topic;
  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags.filter((h): h is string => typeof h === 'string').slice(0, 15)
    : [];
  const title = typeof parsed.title === 'string' ? parsed.title : topic;

  return { caption, hashtags, title };
}
