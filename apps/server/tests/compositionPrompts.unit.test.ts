import { describe, expect, it } from 'vitest';
import { COMPOSITION_REQUIREMENTS_ARRAY } from '../src/services/render/compositionRequirements.js';

describe('Composition Prompt Generation', () => {
  it('builds composition requirements string correctly', () => {
    // This test verifies the composition requirements that will be added to image prompts
    const compositionRequirements = COMPOSITION_REQUIREMENTS_ARRAY.join(', ');

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
    const compositionRequirements = COMPOSITION_REQUIREMENTS_ARRAY.join(', ');

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
    const compositionRequirements = COMPOSITION_REQUIREMENTS_ARRAY.join(', ');

    const fullPrompt = [styleBiblePrompt, visualPrompt, compositionRequirements]
      .filter(Boolean)
      .join('. ');

    // Even without style prompt, composition requirements should be present
    expect(fullPrompt).toContain(visualPrompt);
    expect(fullPrompt).toContain('vertical 9:16 aspect ratio');
    expect(fullPrompt).toContain('clear focal point');
    expect(fullPrompt).not.toContain('.. '); // No double dots from empty style
  });

  it('verifies all required composition elements are present', () => {
    const compositionRequirements = COMPOSITION_REQUIREMENTS_ARRAY.join(', ');

    // Verify every element from the requirements array is in the final string
    COMPOSITION_REQUIREMENTS_ARRAY.forEach((requirement) => {
      expect(compositionRequirements).toContain(requirement);
    });

    // Verify minimum length to ensure meaningful content
    expect(compositionRequirements.length).toBeGreaterThan(100);
  });
});
