import { createHash } from 'crypto';
import { logError } from './logger.js';

export function safeJsonParse<T>(value: string, fallback: T, meta?: Record<string, unknown>): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    const jsonLength = value.length;
    const jsonHash = createHash('sha256').update(value).digest('hex');

    const logContext: Record<string, unknown> = {
      jsonLength,
      jsonHash,
      ...meta,
    };

    // Only include a raw sample when explicitly requested and not in production
    if (meta?.logRawSample && process.env.NODE_ENV !== 'production') {
      logContext.sample = value.slice(0, 200);
    }

    logError('Failed to parse JSON', error, logContext);
    return fallback;
  }
}
