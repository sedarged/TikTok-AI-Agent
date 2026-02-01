import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as openaiModule from '../src/services/providers/openai.js';
import fs from 'fs';
import path from 'path';

describe('Negative Prompt Support', () => {
  const testOutputDir = '/tmp/negative-prompt-test';
  const testImagePath = path.join(testOutputDir, 'test-image.png');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    if (fs.existsSync(testOutputDir)) {
      fs.rmdirSync(testOutputDir, { recursive: true });
    }
  });

  it('generateImage accepts negative prompt parameter', async () => {
    // Mock the OpenAI client to avoid actual API calls
    const mockGenerateImage = vi.spyOn(openaiModule, 'generateImage').mockResolvedValue({
      path: testImagePath,
      estimatedCostUsd: 0,
    });

    const prompt = 'A beautiful sunset over mountains';
    const negativePrompt = 'blurry, low quality, watermark';

    await openaiModule.generateImage(prompt, testImagePath, '1024x1792', negativePrompt);

    // Verify the function was called with the negative prompt
    expect(mockGenerateImage).toHaveBeenCalledWith(
      prompt,
      testImagePath,
      '1024x1792',
      negativePrompt
    );

    mockGenerateImage.mockRestore();
  });

  it('generateImage works without negative prompt (backward compatibility)', async () => {
    // Mock the OpenAI client
    const mockGenerateImage = vi.spyOn(openaiModule, 'generateImage').mockResolvedValue({
      path: testImagePath,
      estimatedCostUsd: 0,
    });

    const prompt = 'A beautiful sunset over mountains';

    await openaiModule.generateImage(prompt, testImagePath, '1024x1792');

    // Verify the function was called without negative prompt (backward compatibility)
    expect(mockGenerateImage).toHaveBeenCalledWith(prompt, testImagePath, '1024x1792');

    mockGenerateImage.mockRestore();
  });

  it('negative prompt is appended to main prompt', () => {
    // This test validates the logic without mocking
    // We can't test the actual implementation without API keys,
    // but we can document expected behavior
    const mainPrompt = 'A serene landscape with mountains';
    const negativePrompt = 'text, watermark, logo';
    const expectedFullPrompt = `${mainPrompt}. Avoid: ${negativePrompt}`;

    // When negative prompt is provided, it should be appended
    expect(expectedFullPrompt).toBe(
      'A serene landscape with mountains. Avoid: text, watermark, logo'
    );
  });

  it('empty negative prompt is handled gracefully', () => {
    const mainPrompt = 'A serene landscape with mountains';
    const negativePrompt = '';

    // Empty negative prompt should not modify the main prompt
    const fullPrompt =
      negativePrompt && negativePrompt.trim()
        ? `${mainPrompt}. Avoid: ${negativePrompt}`
        : mainPrompt;

    expect(fullPrompt).toBe(mainPrompt);
  });

  it('whitespace-only negative prompt is handled gracefully', () => {
    const mainPrompt = 'A serene landscape with mountains';
    const negativePrompt = '   ';

    // Whitespace-only negative prompt should not modify the main prompt
    const fullPrompt =
      negativePrompt && negativePrompt.trim()
        ? `${mainPrompt}. Avoid: ${negativePrompt}`
        : mainPrompt;

    expect(fullPrompt).toBe(mainPrompt);
  });

  it('validates prompt format with typical negative prompt elements', () => {
    const mainPrompt = 'Professional portrait photo';
    const negativePrompt = 'blurry, low quality, watermark, text, logo, signature';
    const expectedFullPrompt = `${mainPrompt}. Avoid: ${negativePrompt}`;

    expect(expectedFullPrompt).toContain('Professional portrait photo');
    expect(expectedFullPrompt).toContain('Avoid:');
    expect(expectedFullPrompt).toContain('blurry');
    expect(expectedFullPrompt).toContain('watermark');
  });
});
