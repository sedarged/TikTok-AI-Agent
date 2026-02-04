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
        return JSON.stringify(topics);
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
    const topics1 = await getTopicSuggestions('facts', 5);
    expect(topics1).toHaveLength(5);
    expect(callOpenAISpy).toHaveBeenCalledTimes(1);

    // Second call with same params - should return from cache
    const topics2 = await getTopicSuggestions('facts', 5);
    expect(topics2).toHaveLength(5);
    expect(topics2).toEqual(topics1); // Should be identical
    expect(callOpenAISpy).toHaveBeenCalledTimes(1); // Still only 1 call

    // Third call with different limit - should hit OpenAI again
    const topics3 = await getTopicSuggestions('facts', 10);
    expect(topics3).toHaveLength(10);
    expect(callOpenAISpy).toHaveBeenCalledTimes(2); // New call

    // Fourth call with different niche - should hit OpenAI again
    const topics4 = await getTopicSuggestions('horror', 5);
    expect(topics4).toHaveLength(5);
    expect(callOpenAISpy).toHaveBeenCalledTimes(3); // New call

    // Fifth call - same as first - should use cache
    const topics5 = await getTopicSuggestions('facts', 5);
    expect(topics5).toEqual(topics1); // Should match first call
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
});
