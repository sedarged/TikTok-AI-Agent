import { beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db/client.js';
import { getTopicSuggestions } from '../src/services/trends/topicSuggestions.js';
import * as openaiModule from '../src/services/providers/openai.js';

async function resetCacheDb() {
  await prisma.cache.deleteMany({ where: { kind: 'topic_suggestions' } });
}

describe('Topic Suggestions Caching', () => {
  let callOpenAISpy: ReturnType<typeof vi.spyOn>;
  let callCount = 0;

  beforeEach(async () => {
    await resetCacheDb();
    callCount = 0;

    // Mock callOpenAI to return mock topic suggestions
    callOpenAISpy = vi
      .spyOn(openaiModule, 'callOpenAI')
      .mockImplementation(async (prompt: string) => {
        callCount++;
        // Extract limit from prompt to return appropriate number of topics
        const match = prompt.match(/exactly (\d+)/);
        const limit = match ? parseInt(match[1], 10) : 10;
        const topics = Array.from({ length: limit }, (_, i) => `Mock Topic ${callCount}-${i + 1}`);
        return {
          content: JSON.stringify(topics),
          usage: {
            model: 'gpt-4o-mini',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: 0,
          },
        };
      });
  });

  afterEach(() => {
    // Clean up the spy after each test
    callOpenAISpy?.mockRestore();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('caches topic suggestions and returns cached result on subsequent calls', async () => {
    // First call - should hit OpenAI
    const result1 = await getTopicSuggestions('facts', 5);
    expect(result1.topics).toHaveLength(5);
    expect(result1.cacheHit).toBe(false);
    expect(callOpenAISpy).toHaveBeenCalledTimes(1);

    // Second call with same params - should return from cache
    const result2 = await getTopicSuggestions('facts', 5);
    expect(result2.topics).toHaveLength(5);
    expect(result2.topics).toEqual(result1.topics); // Should be identical
    expect(result2.cacheHit).toBe(true);
    expect(callOpenAISpy).toHaveBeenCalledTimes(1); // Still only 1 call

    // Third call with different limit - should hit OpenAI again
    const result3 = await getTopicSuggestions('facts', 10);
    expect(result3.topics).toHaveLength(10);
    expect(result3.cacheHit).toBe(false);
    expect(callOpenAISpy).toHaveBeenCalledTimes(2); // New call

    // Fourth call with different niche - should hit OpenAI again
    const result4 = await getTopicSuggestions('horror', 5);
    expect(result4.topics).toHaveLength(5);
    expect(result4.cacheHit).toBe(false);
    expect(callOpenAISpy).toHaveBeenCalledTimes(3); // New call

    // Fifth call - same as first - should use cache
    const result5 = await getTopicSuggestions('facts', 5);
    expect(result5.topics).toEqual(result1.topics); // Should match first call
    expect(result5.cacheHit).toBe(true);
    expect(callOpenAISpy).toHaveBeenCalledTimes(3); // No new call
  });

  it('stores cache entries in database with correct structure', async () => {
    await getTopicSuggestions('gaming', 7);

    const cacheEntries = await prisma.cache.findMany({
      where: { kind: 'topic_suggestions' },
    });

    expect(cacheEntries).toHaveLength(1);
    const entry = cacheEntries[0];
    expect(entry.kind).toBe('topic_suggestions');
    expect(entry.hashKey).toBeDefined();
    expect(entry.resultJson).toBeDefined();

    let result: { topics: string[] };
    try {
      result = JSON.parse(entry.resultJson) as { topics: string[] };
    } catch (error) {
      throw new Error(
        `Failed to parse cached topic suggestions JSON: ${(error as Error).message}`,
        {
          cause: error,
        }
      );
    }
    expect(result.topics).toHaveLength(7);
    expect(Array.isArray(result.topics)).toBe(true);
  });

  it('cache key is based on nichePackId and limit', async () => {
    // Call with two different parameter combinations
    await getTopicSuggestions('motivation', 8);
    await getTopicSuggestions('motivation', 12);
    await getTopicSuggestions('conspiracy', 8);

    const cacheEntries = await prisma.cache.findMany({
      where: { kind: 'topic_suggestions' },
    });

    // Should have 3 distinct cache entries
    expect(cacheEntries).toHaveLength(3);

    // All should have different hash keys
    const hashKeys = cacheEntries.map((e) => e.hashKey);
    const uniqueHashKeys = new Set(hashKeys);
    expect(uniqueHashKeys.size).toBe(3);
  });

  it('handles OpenAI json_object wrapper format', async () => {
    // Reset cache and spy
    await resetCacheDb();
    callOpenAISpy?.mockRestore();

    // Mock callOpenAI to return wrapper object format (OpenAI json_object mode)
    callOpenAISpy = vi.spyOn(openaiModule, 'callOpenAI').mockImplementation(async () => {
      return {
        content: JSON.stringify({
          topics: ['Wrapped Topic 1', 'Wrapped Topic 2', 'Wrapped Topic 3'],
        }),
        usage: {
          model: 'gpt-4o-mini',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: 0,
        },
      };
    });

    const result = await getTopicSuggestions('facts', 3);

    expect(result.topics).toHaveLength(3);
    expect(result.topics[0]).toBe('Wrapped Topic 1');
    expect(result.topics[1]).toBe('Wrapped Topic 2');
    expect(result.topics[2]).toBe('Wrapped Topic 3');
    expect(result.cacheHit).toBe(false);
    expect(callOpenAISpy).toHaveBeenCalledTimes(1);
  });

  it('sets expiresAt field with 20 minute TTL', async () => {
    await getTopicSuggestions('gaming', 7);

    const cacheEntries = await prisma.cache.findMany({
      where: { kind: 'topic_suggestions' },
    });

    expect(cacheEntries).toHaveLength(1);
    const entry = cacheEntries[0];
    expect(entry.expiresAt).toBeDefined();
    expect(entry.expiresAt).not.toBeNull();

    if (entry.expiresAt) {
      // expiresAt should be approximately 20 minutes (1200 seconds) after createdAt
      const expectedExpiry = new Date(entry.createdAt.getTime() + 1200 * 1000);
      const timeDiff = Math.abs(entry.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(2000); // Allow 2 second tolerance
    }
  });

  it('returns MISS when cache expires', async () => {
    // Create a cache entry that's already expired
    const cacheKey = openaiModule.createHash('topic_suggestions', 'facts', '5');
    const expiredTime = new Date(Date.now() - 1000); // Expired 1 second ago

    await prisma.cache.create({
      data: {
        hashKey: cacheKey,
        kind: 'topic_suggestions',
        resultJson: JSON.stringify({ topics: ['Expired Topic 1', 'Expired Topic 2'] }),
        expiresAt: expiredTime,
      },
    });

    // This should hit OpenAI since cache is expired
    const result = await getTopicSuggestions('facts', 5);
    expect(result.cacheHit).toBe(false);
    expect(callOpenAISpy).toHaveBeenCalledTimes(1);

    // Verify expired cache was deleted
    const cacheEntry = await prisma.cache.findUnique({ where: { hashKey: cacheKey } });
    // It will be recreated with new data, but should have a new expiresAt
    expect(cacheEntry).toBeDefined();
    if (cacheEntry?.expiresAt) {
      expect(cacheEntry.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });
});
