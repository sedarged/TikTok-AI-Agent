import { describe, it, expect } from 'vitest';
import { safeJsonParse } from '../src/utils/safeJsonParse.js';

describe('safeJsonParse', () => {
  it('should parse valid JSON correctly', () => {
    const validJson = '{"key": "value", "number": 42}';
    const result = safeJsonParse(validJson, { default: true });

    expect(result).toEqual({ key: 'value', number: 42 });
  });

  it('should return fallback on malformed JSON', () => {
    const malformedJson = '{"key": "value"';
    const fallback = { default: true };
    const result = safeJsonParse(malformedJson, fallback);

    expect(result).toBe(fallback);
    expect(result).toEqual({ default: true });
  });

  it('should not throw on invalid JSON', () => {
    const invalidJson = 'not json at all';
    const fallback = { error: 'fallback' };

    expect(() => {
      safeJsonParse(invalidJson, fallback);
    }).not.toThrow();
  });

  it('should preserve valid parses with complex objects', () => {
    const complexJson = '{"nested": {"array": [1, 2, 3]}, "bool": true, "null": null}';
    const result = safeJsonParse(complexJson, {});

    expect(result).toEqual({
      nested: { array: [1, 2, 3] },
      bool: true,
      null: null,
    });
  });

  it('should handle empty string gracefully', () => {
    const emptyString = '';
    const fallback = { empty: true };
    const result = safeJsonParse(emptyString, fallback);

    expect(result).toBe(fallback);
  });

  it('should handle arrays correctly', () => {
    const arrayJson = '[1, 2, 3, "four"]';
    const result = safeJsonParse<unknown[]>(arrayJson, []);

    expect(result).toEqual([1, 2, 3, 'four']);
  });

  it('should return fallback for arrays when JSON is malformed', () => {
    const malformedArrayJson = '[1, 2, 3';
    const fallback: number[] = [];
    const result = safeJsonParse(malformedArrayJson, fallback);

    expect(result).toBe(fallback);
  });

  it('should handle meta parameter without affecting parsing', () => {
    const validJson = '{"test": true}';
    const result = safeJsonParse(validJson, {}, { contextId: 'test-123' });

    expect(result).toEqual({ test: true });
  });
});
