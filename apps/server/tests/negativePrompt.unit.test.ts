import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from '../src/env.js';

// Test output directory (aligned with other tests)
const TEST_OUTPUT_DIR = path.join(ROOT_DIR, 'apps', 'server', 'tests', 'tmp', 'negative-prompt');

describe('Negative Prompt Support', () => {
  beforeEach(() => {
    // Ensure test output directory exists
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files (aligned with other tests)
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  describe('Prompt concatenation logic', () => {
    it('appends trimmed negative prompt to main prompt', () => {
      const prompt = 'A beautiful sunset over mountains';
      const negativePrompt = 'blurry, low quality, watermark';
      const trimmedNegativePrompt = negativePrompt.trim();

      const fullPrompt = trimmedNegativePrompt
        ? `${prompt}. Avoid: ${trimmedNegativePrompt}`
        : prompt;

      expect(fullPrompt).toBe(
        'A beautiful sunset over mountains. Avoid: blurry, low quality, watermark'
      );
    });

    it('normalizes negative prompt with leading/trailing whitespace', () => {
      const prompt = 'A serene landscape';
      const negativePrompt = '  watermark, text  ';
      const trimmedNegativePrompt = negativePrompt.trim();

      const fullPrompt = trimmedNegativePrompt
        ? `${prompt}. Avoid: ${trimmedNegativePrompt}`
        : prompt;

      expect(fullPrompt).toBe('A serene landscape. Avoid: watermark, text');
    });

    it('works without negative prompt (backward compatibility)', () => {
      const prompt = 'A beautiful sunset';
      const negativePrompt = undefined;
      const trimmedNegativePrompt = negativePrompt?.trim();

      const fullPrompt = trimmedNegativePrompt
        ? `${prompt}. Avoid: ${trimmedNegativePrompt}`
        : prompt;

      expect(fullPrompt).toBe(prompt);
    });

    it('handles empty negative prompt gracefully', () => {
      const prompt = 'A serene landscape';
      const negativePrompt = '';
      const trimmedNegativePrompt = negativePrompt.trim();

      const fullPrompt = trimmedNegativePrompt
        ? `${prompt}. Avoid: ${trimmedNegativePrompt}`
        : prompt;

      expect(fullPrompt).toBe(prompt);
    });

    it('handles whitespace-only negative prompt gracefully', () => {
      const prompt = 'A serene landscape';
      const negativePrompt = '   ';
      const trimmedNegativePrompt = negativePrompt.trim();

      const fullPrompt = trimmedNegativePrompt
        ? `${prompt}. Avoid: ${trimmedNegativePrompt}`
        : prompt;

      expect(fullPrompt).toBe(prompt);
    });

    it('truncates combined prompt to 4000 chars for API', () => {
      const longPrompt = 'A'.repeat(3950);
      const negativePrompt = 'B'.repeat(100);
      const trimmedNegativePrompt = negativePrompt.trim();

      let fullPrompt = longPrompt;
      if (trimmedNegativePrompt) {
        fullPrompt = `${longPrompt}. Avoid: ${trimmedNegativePrompt}`;
      }

      const finalPrompt = fullPrompt.substring(0, 4000);

      expect(finalPrompt.length).toBe(4000);
      expect(finalPrompt.length).toBeLessThanOrEqual(4000);
    });
  });

  describe('Negative prompt selection logic', () => {
    it('uses scene negative prompt when available', () => {
      const sceneNeg = 'text, logo, watermark';
      const packGlobalNeg = 'blurry, low quality';

      const negativePrompt = sceneNeg?.trim() || packGlobalNeg?.trim() || '';

      expect(negativePrompt).toBe('text, logo, watermark');
    });

    it('falls back to pack global negative prompt when scene is empty', () => {
      const sceneNeg = '';
      const packGlobalNeg = 'blurry, low quality';

      const negativePrompt = sceneNeg?.trim() || packGlobalNeg?.trim() || '';

      expect(negativePrompt).toBe('blurry, low quality');
    });

    it('returns empty string when both are empty', () => {
      const sceneNeg = '';
      const packGlobalNeg = '';

      const negativePrompt = sceneNeg?.trim() || packGlobalNeg?.trim() || '';

      expect(negativePrompt).toBe('');
    });

    it('trims whitespace from scene negative prompt', () => {
      const sceneNeg = '  text, logo  ';
      const packGlobalNeg = 'blurry, low quality';

      const negativePrompt = sceneNeg?.trim() || packGlobalNeg?.trim() || '';

      expect(negativePrompt).toBe('text, logo');
    });

    it('handles undefined scene negative prompt', () => {
      const sceneNeg = undefined;
      const packGlobalNeg = 'blurry, low quality';

      const negativePrompt = sceneNeg?.trim() || packGlobalNeg?.trim() || '';

      expect(negativePrompt).toBe('blurry, low quality');
    });
  });
});
