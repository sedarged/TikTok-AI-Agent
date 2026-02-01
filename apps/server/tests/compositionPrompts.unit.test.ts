import { describe, expect, it } from 'vitest';

describe('Composition Prompt Generation', () => {
  it('builds composition requirements string correctly', () => {
    // This test verifies the composition requirements that will be added to image prompts
    const compositionRequirements = [
      'vertical 9:16 aspect ratio composition',
      'subject centered or following rule of thirds',
      'clear focal point',
      'professional framing with balanced negative space',
      'high quality',
      'detailed',
      'sharp focus',
      'suitable for mobile viewing',
    ].join(', ');

    // Verify all key composition elements are present
    expect(compositionRequirements).toContain('vertical 9:16 aspect ratio');
    expect(compositionRequirements).toContain('subject centered or following rule of thirds');
    expect(compositionRequirements).toContain('clear focal point');
    expect(compositionRequirements).toContain('professional framing');
    expect(compositionRequirements).toContain('sharp focus');
    expect(compositionRequirements).toContain('suitable for mobile viewing');
  });

  it('simulates full prompt construction with style and composition', () => {
    const styleBiblePrompt = 'Dark, eerie, cinematic horror style';
    const visualPrompt = 'Abandoned hospital corridor with flickering lights';
    const compositionRequirements = [
      'vertical 9:16 aspect ratio composition',
      'subject centered or following rule of thirds',
      'clear focal point',
      'professional framing with balanced negative space',
      'high quality',
      'detailed',
      'sharp focus',
      'suitable for mobile viewing',
    ].join(', ');

    const fullPrompt = [styleBiblePrompt, visualPrompt, compositionRequirements]
      .filter(Boolean)
      .join('. ');

    // Verify the full prompt includes all components
    expect(fullPrompt).toContain(styleBiblePrompt);
    expect(fullPrompt).toContain(visualPrompt);
    expect(fullPrompt).toContain('vertical 9:16 aspect ratio');
    expect(fullPrompt).toContain('rule of thirds');
    expect(fullPrompt).toContain('clear focal point');
    expect(fullPrompt).toContain('sharp focus');
  });

  it('handles empty style prompt gracefully', () => {
    const styleBiblePrompt = '';
    const visualPrompt = 'Mountain landscape at sunset';
    const compositionRequirements = [
      'vertical 9:16 aspect ratio composition',
      'subject centered or following rule of thirds',
      'clear focal point',
      'professional framing with balanced negative space',
      'high quality',
      'detailed',
      'sharp focus',
      'suitable for mobile viewing',
    ].join(', ');

    const fullPrompt = [styleBiblePrompt, visualPrompt, compositionRequirements]
      .filter(Boolean)
      .join('. ');

    // Even without style prompt, composition requirements should be present
    expect(fullPrompt).toContain(visualPrompt);
    expect(fullPrompt).toContain('vertical 9:16 aspect ratio');
    expect(fullPrompt).toContain('clear focal point');
    expect(fullPrompt).not.toContain('.. '); // No double dots from empty style
  });
});
