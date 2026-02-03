import { describe, expect, it } from 'vitest';

/**
 * Unit test for MAX_CONCURRENT_IMAGE_GENERATION validation
 *
 * This test verifies that the MAX_CONCURRENT_IMAGE_GENERATION environment
 * variable validation logic works correctly for various input values.
 */

describe('MAX_CONCURRENT_IMAGE_GENERATION Validation Logic', () => {
  // This function replicates the validation logic from renderPipeline.ts
  function validateMaxConcurrent(envValue: string | undefined): number {
    const parsedMaxConcurrentImages = envValue ? Number.parseInt(envValue, 10) : 3;

    return Number.isInteger(parsedMaxConcurrentImages) && parsedMaxConcurrentImages > 0
      ? parsedMaxConcurrentImages
      : 3;
  }

  it('should use default value of 3 when env var is not set', () => {
    const result = validateMaxConcurrent(undefined);
    expect(result).toBe(3);
  });

  it('should use valid positive integer from env var', () => {
    const result = validateMaxConcurrent('5');
    expect(result).toBe(5);
  });

  it('should fall back to default for negative numbers', () => {
    const result = validateMaxConcurrent('-1');
    expect(result).toBe(3);
  });

  it('should fall back to default for zero', () => {
    const result = validateMaxConcurrent('0');
    expect(result).toBe(3);
  });

  it('should fall back to default for non-numeric values', () => {
    const result = validateMaxConcurrent('invalid');
    expect(result).toBe(3);
  });

  it('should parse and accept decimal strings as integers', () => {
    // parseInt('3.5', 10) returns 3
    const result = validateMaxConcurrent('3.5');
    expect(result).toBe(3);
  });

  it('should accept large positive integers', () => {
    const result = validateMaxConcurrent('100');
    expect(result).toBe(100);
  });

  it('should accept string with value 1', () => {
    const result = validateMaxConcurrent('1');
    expect(result).toBe(1);
  });

  it('should fall back to default for empty string', () => {
    const result = validateMaxConcurrent('');
    expect(result).toBe(3);
  });
});
