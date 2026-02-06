import { logError } from './logger.js';

export function safeJsonParse<T>(value: string, fallback: T, meta?: Record<string, unknown>): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logError('Failed to parse JSON', error, {
      sample: value.slice(0, 200),
      ...meta,
    });
    return fallback;
  }
}
