import { Router } from 'express';
import { z } from 'zod';
import { getTopicSuggestions } from '../services/trends/topicSuggestions.js';
import { getNichePack } from '../services/nichePacks.js';
import { isOpenAIConfigured, isTestMode } from '../env.js';

export const topicSuggestionsRoutes = Router();

const querySchema = z.object({
  nichePackId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

/**
 * GET /api/topic-suggestions?nichePackId=facts&limit=10
 * Returns AI-suggested viral topics for the niche (array of strings).
 */
topicSuggestionsRoutes.get('/', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Topic suggestions disabled in APP_TEST_MODE',
        code: 'SUGGESTIONS_DISABLED_TEST_MODE',
      });
    }
    if (!isOpenAIConfigured()) {
      return res.status(400).json({
        error: 'OpenAI API key not configured',
        code: 'OPENAI_NOT_CONFIGURED',
      });
    }

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query',
        details: parsed.error.flatten(),
      });
    }

    const { nichePackId, limit } = parsed.data;
    const pack = getNichePack(nichePackId);
    if (!pack) {
      return res.status(400).json({ error: 'Invalid niche pack' });
    }

    const topics = await getTopicSuggestions(nichePackId, limit);
    res.json(topics);
  } catch (error) {
    console.error('Error getting topic suggestions:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get suggestions',
    });
  }
});
