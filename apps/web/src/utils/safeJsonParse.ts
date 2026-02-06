export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON', error);
    return fallback;
  }
}
