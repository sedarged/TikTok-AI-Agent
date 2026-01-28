import OpenAI from 'openai';
import { env } from '../../env.js';

export function getOpenAIClientOrThrow() {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set.');
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

