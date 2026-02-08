/**
 * AI topic suggestions for TikTok – returns viral-style topic ideas for a niche.
 */
import { callOpenAI, createHash, getCachedResult, cacheResult } from '../providers/openai.js';
import { getNichePack } from '../nichePacks.js';
import { logError, logDebug } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';

/**
 * Helper to unwrap an array from either raw array or {field: array} wrapper object.
 * Handles both legacy array format (tests) and OpenAI json_object format.
 */
function unwrapArrayField<T>(parsed: unknown, fieldName: string): T[] | null {
  if (Array.isArray(parsed)) {
    return parsed as T[];
  }
  if (typeof parsed === 'object' && parsed !== null && fieldName in parsed) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj[fieldName])) {
      return obj[fieldName] as T[];
    }
  }
  return null;
}

export interface TopicSuggestionsResult {
  topics: string[];
  cacheHit: boolean;
}

export async function getTopicSuggestions(
  nichePackId: string,
  limit: number = 10
): Promise<TopicSuggestionsResult> {
  // Check cache first
  const cacheKey = createHash('topic_suggestions', nichePackId, String(limit));
  const cached = await getCachedResult(cacheKey);

  if (cached && cached.resultJson) {
    const result = safeJsonParse<{ topics?: string[] }>(cached.resultJson, {
      topics: undefined,
    });
    if (result.topics && Array.isArray(result.topics)) {
      logDebug(`Cache hit for topic suggestions: ${cacheKey}`);
      return { topics: result.topics, cacheHit: true };
    }
  }

  const pack = getNichePack(nichePackId);
  const nicheName = pack?.name ?? nichePackId;

  const prompt = `You are a TikTok content strategist. For the niche "${nicheName}", suggest exactly ${limit} short-form video topic ideas with high viral potential. Each topic should be one short phrase or sentence (under 15 words). Return ONLY a valid JSON object with a "topics" array of strings, no other text. Example: {"topics": ["Topic 1", "Topic 2", "Topic 3"]}`;

  const raw = await callOpenAI(prompt, 'json', 'gpt-4o-mini');
  const trimmed = raw.trim();

  const parsed = safeJsonParse<unknown>(trimmed, null, { source: 'topicSuggestions' });
  if (!parsed) {
    logError('Failed to parse JSON response from OpenAI');
    throw new Error('Invalid JSON response from AI');
  }

  // Handle both array (legacy/test) and object (OpenAI json_object) formats
  const topicsArray = unwrapArrayField<unknown>(parsed, 'topics');
  if (!topicsArray) {
    throw new Error('Expected JSON object with topics array or JSON array');
  }

  const topics = topicsArray
    .filter((x): x is string => typeof x === 'string')
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, limit);

  // Cache the result with 20 minute TTL (1200 seconds)
  await cacheResult(cacheKey, 'topic_suggestions', { topics }, undefined, 1200);

  return { topics, cacheHit: false };
}
