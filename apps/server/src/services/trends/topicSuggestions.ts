/**
 * AI topic suggestions for TikTok – returns viral-style topic ideas for a niche.
 */
import { callOpenAI } from '../providers/openai.js';
import { getNichePack } from '../nichePacks.js';

export async function getTopicSuggestions(
  nichePackId: string,
  limit: number = 10
): Promise<string[]> {
  const pack = getNichePack(nichePackId);
  const nicheName = pack?.name ?? nichePackId;

  const prompt = `You are a TikTok content strategist. For the niche "${nicheName}", suggest exactly ${limit} short-form video topic ideas with high viral potential. Each topic should be one short phrase or sentence (under 15 words). Return ONLY a valid JSON array of strings, no other text. Example: ["Topic 1", "Topic 2", "Topic 3"]`;

  const raw = await callOpenAI(prompt, 'json', 'gpt-4o-mini');
  const trimmed = raw.trim();
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array of topic strings');
  }
  return parsed
    .filter((x): x is string => typeof x === 'string')
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, limit);
}
