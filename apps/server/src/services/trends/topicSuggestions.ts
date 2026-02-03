/**
 * AI topic suggestions for TikTok – returns viral-style topic ideas for a niche.
 */
import { callOpenAI } from '../providers/openai.js';
import { getNichePack } from '../nichePacks.js';
import { logError, logDebug } from '../../utils/logger.js';
import { prisma } from '../../db/client.js';
import crypto from 'crypto';

/**
 * Create a hash key for caching
 */
function createCacheHash(...args: string[]): string {
  return crypto.createHash('md5').update(args.join('|')).digest('hex');
}

/**
 * Get cached topic suggestions from database
 */
async function getCachedTopicSuggestions(hashKey: string): Promise<string[] | null> {
  try {
    const cached = await prisma.cache.findUnique({
      where: { hashKey },
    });

    if (cached && cached.resultJson) {
      const result = JSON.parse(cached.resultJson) as { topics: string[] };
      logDebug(`Cache hit for topic suggestions: ${hashKey}`);
      return result.topics;
    }
  } catch (error) {
    logError('Failed to get cached topic suggestions:', error);
  }
  return null;
}

/**
 * Store topic suggestions in cache
 */
async function cacheTopicSuggestions(hashKey: string, topics: string[]): Promise<void> {
  try {
    await prisma.cache.upsert({
      where: { hashKey },
      create: {
        hashKey,
        kind: 'topic_suggestions',
        resultJson: JSON.stringify({ topics }),
      },
      update: {
        resultJson: JSON.stringify({ topics }),
      },
    });
    logDebug(`Cached topic suggestions: ${hashKey}`);
  } catch (error) {
    logError('Failed to cache topic suggestions:', error);
  }
}

export async function getTopicSuggestions(
  nichePackId: string,
  limit: number = 10
): Promise<string[]> {
  // Check cache first
  const cacheKey = createCacheHash('topic_suggestions', nichePackId, String(limit));
  const cached = await getCachedTopicSuggestions(cacheKey);
  if (cached) {
    return cached;
  }

  const pack = getNichePack(nichePackId);
  const nicheName = pack?.name ?? nichePackId;

  const prompt = `You are a TikTok content strategist. For the niche "${nicheName}", suggest exactly ${limit} short-form video topic ideas with high viral potential. Each topic should be one short phrase or sentence (under 15 words). Return ONLY a valid JSON array of strings, no other text. Example: ["Topic 1", "Topic 2", "Topic 3"]`;

  const raw = await callOpenAI(prompt, 'json', 'gpt-4o-mini');
  const trimmed = raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    logError('Failed to parse JSON response from OpenAI', error);
    throw new Error('Invalid JSON response from AI');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array of topic strings');
  }
  const topics = parsed
    .filter((x): x is string => typeof x === 'string')
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, limit);

  // Cache the result
  await cacheTopicSuggestions(cacheKey, topics);

  return topics;
}
