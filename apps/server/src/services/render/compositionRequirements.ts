/**
 * Composition requirements for DALL-E 3 image generation.
 * These requirements ensure consistent, professional image composition
 * optimized for vertical mobile video content.
 */
export const COMPOSITION_REQUIREMENTS_ARRAY = [
  'vertical 9:16 aspect ratio composition',
  'subject centered or following rule of thirds',
  'clear focal point',
  'professional framing with balanced negative space',
  'high quality',
  'detailed',
  'sharp focus',
  'suitable for mobile viewing',
] as const;

/**
 * Pre-built composition requirements string for use in DALL-E 3 prompts.
 */
export const COMPOSITION_REQUIREMENTS = COMPOSITION_REQUIREMENTS_ARRAY.join(', ');
