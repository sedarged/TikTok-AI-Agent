/**
 * AI topic suggestions for TikTok – returns viral-style topic ideas for a niche.
 */
import { callOpenAI, createHash, getCachedResult, cacheResult } from '../providers/openai.js';
import { getNichePack } from '../nichePacks.js';
import { logError, logDebug } from '../../utils/logger.js';

export async function getTopicSuggestions(
  nichePackId: string,
  limit: number = 10
): Promise<string[]> {
  // Check cache first
  const cacheKey = createHash('topic_suggestions', nichePackId, String(limit));
  const cached = await getCachedResult(cacheKey);

  if (cached && cached.resultJson) {
    try {
      const result = JSON.parse(cached.resultJson) as { topics: string[] };
      if (result.topics && Array.isArray(result.topics)) {
        logDebug(`Cache hit for topic suggestions: ${cacheKey}`);
        return result.topics;
      }
    } catch (error) {
      logError('Failed to parse cached topic suggestions:', error);
    }
  }

  const pack = getNichePack(nichePackId);
  const nicheName = pack?.name ?? nichePackId;

  const prompt = `You are a TikTok content strategist. For the niche "${nicheName}", suggest exactly ${limit} short-form video topic ideas with high viral potential. Each topic should be one short phrase or sentence (under 15 words). Return ONLY a valid JSON object with a "topics" array of strings, no other text. Example: {"topics": ["Topic 1", "Topic 2", "Topic 3"]}`;

  const raw = await callOpenAI(prompt, 'json', 'gpt-4o-mini');
  const trimmed = raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    logError('Failed to parse JSON response from OpenAI', error);
    throw new Error('Invalid JSON response from AI');
  }

  // Handle both array (legacy/test) and object (OpenAI json_object) formats
  let topicsArray: unknown[];
  if (Array.isArray(parsed)) {
    topicsArray = parsed;
  } else if (typeof parsed === 'object' && parsed !== null && 'topics' in parsed) {
    const obj = parsed as { topics?: unknown };
    if (!Array.isArray(obj.topics)) {
      throw new Error('Expected JSON object with topics array');
    }
    topicsArray = obj.topics;
  } else {
    throw new Error('Expected JSON object with topics array or JSON array');
  }
  const topics = topicsArray
    .filter((x): x is string => typeof x === 'string')
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, limit);

  // Cache the result
  await cacheResult(cacheKey, 'topic_suggestions', { topics });

  return topics;
}
