import type { EffectPreset } from '../utils/types.js';

export interface ScenePacing {
  minScenes: number;
  maxScenes: number;
  minDurationSec: number;
  maxDurationSec: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  outlineWidth: number;
  highlightColor: string;
  marginBottom: number;
  marginHorizontal: number;
}

export interface EffectsProfile {
  allowedEffects: EffectPreset[];
  defaultEffect: EffectPreset;
}

export interface NichePack {
  id: string;
  name: string;
  description: string;
  styleBiblePrompt: string;
  globalNegativePrompt: string;
  hookRules: string[];
  scenePacing: {
    60: ScenePacing;
    90: ScenePacing;
    120: ScenePacing;
    180: ScenePacing;
  };
  captionStyle: CaptionStyle;
  effectsProfile: EffectsProfile;
}

const DEFAULT_NEGATIVE_PROMPT =
  'blurry, low quality, watermark, text, logo, signature, cropped, out of frame, worst quality, low resolution, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, ugly, disfigured, bad anatomy, bad proportions, extra limbs, cloned face, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck';

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Arial Black',
  fontSize: 48,
  primaryColor: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 4,
  highlightColor: '#FFD700',
  marginBottom: 200,
  marginHorizontal: 40,
};

export const NICHE_PACKS: NichePack[] = [
  {
    id: 'horror',
    name: 'Horror Stories',
    description: 'Creepy, atmospheric horror content',
    styleBiblePrompt:
      'Dark, eerie, cinematic horror style, atmospheric lighting, muted colors with red accents, fog and shadows, unsettling imagery, high contrast, dramatic composition',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', happy, bright colors, cartoon, anime',
    hookRules: [
      'Start with a chilling statement or question',
      'Reference a specific creepy location or time',
      'Use second person to involve the viewer',
      'Create immediate tension or dread',
      'Hint at something terrible without revealing it',
    ],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 8, minDurationSec: 5, maxDurationSec: 12 },
      90: { minScenes: 8, maxScenes: 10, minDurationSec: 6, maxDurationSec: 14 },
      120: { minScenes: 10, maxScenes: 12, minDurationSec: 7, maxDurationSec: 15 },
      180: { minScenes: 12, maxScenes: 16, minDurationSec: 8, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#FF0000',
      highlightColor: '#FFFFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'fade', 'glitch', 'flash_cut'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'facts',
    name: 'Amazing Facts',
    description: 'Mind-blowing facts and information',
    styleBiblePrompt:
      'Clean, modern, educational style, bright vibrant colors, clear composition, infographic aesthetic, professional photography style, well-lit subjects',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    hookRules: [
      'Start with "Did you know..." or similar',
      'Lead with the most surprising fact',
      'Use numbers and statistics',
      'Challenge common beliefs',
      'Promise to reveal something unknown',
    ],
    scenePacing: {
      60: { minScenes: 5, maxScenes: 7, minDurationSec: 6, maxDurationSec: 14 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 7, maxDurationSec: 15 },
      120: { minScenes: 9, maxScenes: 11, minDurationSec: 8, maxDurationSec: 16 },
      180: { minScenes: 11, maxScenes: 14, minDurationSec: 9, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#00D4FF',
      highlightColor: '#FFD700',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'motivation',
    name: 'Motivation',
    description: 'Inspirational and motivational content',
    styleBiblePrompt:
      'Inspiring, epic, cinematic style, golden hour lighting, dramatic skies, powerful imagery, hero shots, aspirational scenes, mountains and sunrises, determined expressions',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', sad, depressing, dark mood',
    hookRules: [
      'Start with a powerful statement',
      'Reference overcoming adversity',
      'Use commanding language',
      'Create urgency for change',
      'Promise transformation or growth',
    ],
    scenePacing: {
      60: { minScenes: 5, maxScenes: 7, minDurationSec: 7, maxDurationSec: 14 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 8, maxDurationSec: 15 },
      120: { minScenes: 9, maxScenes: 11, minDurationSec: 9, maxDurationSec: 16 },
      180: { minScenes: 11, maxScenes: 14, minDurationSec: 10, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#FFD700',
      highlightColor: '#FFFFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'tilt_up', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'product',
    name: 'Product Showcase',
    description: 'Product reviews and showcases',
    styleBiblePrompt:
      'Clean product photography style, studio lighting, minimalist backgrounds, professional product shots, macro details, sleek and modern aesthetic',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', cluttered background, amateur lighting',
    hookRules: [
      'Start with the problem the product solves',
      'Mention a surprising benefit',
      'Use social proof if applicable',
      'Create curiosity about features',
      'Promise an honest review',
    ],
    scenePacing: {
      60: { minScenes: 5, maxScenes: 7, minDurationSec: 6, maxDurationSec: 14 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 7, maxDurationSec: 15 },
      120: { minScenes: 9, maxScenes: 11, minDurationSec: 8, maxDurationSec: 16 },
      180: { minScenes: 11, maxScenes: 14, minDurationSec: 9, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#FFFFFF',
      highlightColor: '#00FF88',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'story',
    name: 'Storytelling',
    description: 'Narrative stories and tales',
    styleBiblePrompt:
      'Cinematic storytelling style, movie-like composition, dramatic lighting, emotional scenes, narrative imagery, rich colors and atmosphere',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    hookRules: [
      'Start in the middle of action',
      'Create immediate mystery',
      'Introduce a compelling character',
      'Set up stakes quickly',
      'Use vivid sensory details',
    ],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 8, minDurationSec: 6, maxDurationSec: 12 },
      90: { minScenes: 8, maxScenes: 10, minDurationSec: 7, maxDurationSec: 14 },
      120: { minScenes: 10, maxScenes: 12, minDurationSec: 8, maxDurationSec: 15 },
      180: { minScenes: 12, maxScenes: 16, minDurationSec: 9, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#FFFFFF',
      highlightColor: '#FF6B6B',
    },
    effectsProfile: {
      allowedEffects: [
        'slow_zoom_in',
        'slow_zoom_out',
        'pan_left',
        'pan_right',
        'fade',
        'flash_cut',
      ],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'top5',
    name: 'Top 5 Lists',
    description: 'Countdown and ranking content',
    styleBiblePrompt:
      'Bold, dynamic list style, vibrant colors, clear numbered graphics aesthetic, eye-catching compositions, variety of subjects, engaging visuals',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    hookRules: [
      'Tease the number one item',
      'Promise surprising entries',
      'Challenge viewer expectations',
      'Use superlatives',
      'Create anticipation for the list',
    ],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 7, minDurationSec: 7, maxDurationSec: 12 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 8, maxDurationSec: 14 },
      120: { minScenes: 8, maxScenes: 10, minDurationSec: 10, maxDurationSec: 16 },
      180: { minScenes: 10, maxScenes: 12, minDurationSec: 12, maxDurationSec: 20 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#FF4444',
      highlightColor: '#FFD700',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'flash_cut', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'finance_tips',
    name: 'Finance Tips',
    description: 'Educational financial advice',
    styleBiblePrompt:
      'Professional finance style, clean and trustworthy aesthetic, business imagery, charts and graphs visual style, money and success imagery, corporate colors',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', get rich quick, scam',
    hookRules: [
      'Start with a money-saving revelation',
      'Reference common financial mistakes',
      'Use specific numbers and percentages',
      'Promise actionable advice',
      'Create urgency about financial health',
    ],
    scenePacing: {
      60: { minScenes: 5, maxScenes: 7, minDurationSec: 7, maxDurationSec: 14 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 8, maxDurationSec: 15 },
      120: { minScenes: 9, maxScenes: 11, minDurationSec: 9, maxDurationSec: 16 },
      180: { minScenes: 11, maxScenes: 14, minDurationSec: 10, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#00CC66',
      highlightColor: '#FFFFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'health_myths',
    name: 'Health Myths',
    description: 'Debunking health misconceptions',
    styleBiblePrompt:
      'Clean medical and health style, bright and trustworthy aesthetic, wellness imagery, scientific yet approachable, green and blue tones, healthy lifestyle visuals',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', graphic medical imagery, blood, injury',
    hookRules: [
      'Challenge a common health belief',
      'Start with "You\'ve been told wrong"',
      'Reference scientific research',
      'Create urgency about health',
      'Promise truth over myths',
    ],
    scenePacing: {
      60: { minScenes: 5, maxScenes: 7, minDurationSec: 7, maxDurationSec: 14 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 8, maxDurationSec: 15 },
      120: { minScenes: 9, maxScenes: 11, minDurationSec: 9, maxDurationSec: 16 },
      180: { minScenes: 11, maxScenes: 14, minDurationSec: 10, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#44CC88',
      highlightColor: '#FFFFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'history',
    name: 'History',
    description: 'Historical events and stories',
    styleBiblePrompt:
      'Epic historical style, cinematic period imagery, sepia and muted tones with dramatic accents, grand architecture, historical scenes reimagined, documentary aesthetic',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', modern elements, anachronistic',
    hookRules: [
      'Start with a dramatic historical moment',
      'Reference a specific date or era',
      'Mention little-known historical facts',
      'Create connection to present day',
      'Build mystery around historical figures',
    ],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 8, minDurationSec: 6, maxDurationSec: 12 },
      90: { minScenes: 8, maxScenes: 10, minDurationSec: 7, maxDurationSec: 14 },
      120: { minScenes: 10, maxScenes: 12, minDurationSec: 8, maxDurationSec: 15 },
      180: { minScenes: 12, maxScenes: 16, minDurationSec: 9, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#D4AF37',
      highlightColor: '#FFFFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Gaming content and stories',
    styleBiblePrompt:
      'Vibrant gaming style, neon accents, digital aesthetic, game-inspired visuals, dynamic action shots, cyberpunk and fantasy elements, glowing effects',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    hookRules: [
      'Reference popular game mechanics',
      'Create nostalgia for classic games',
      'Tease epic gaming moments',
      'Challenge gaming skills',
      'Promise insider knowledge',
    ],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 8, minDurationSec: 5, maxDurationSec: 12 },
      90: { minScenes: 8, maxScenes: 10, minDurationSec: 6, maxDurationSec: 14 },
      120: { minScenes: 10, maxScenes: 12, minDurationSec: 7, maxDurationSec: 15 },
      180: { minScenes: 12, maxScenes: 16, minDurationSec: 8, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#FF00FF',
      highlightColor: '#00FFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'glitch', 'flash_cut', 'fade'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'science',
    name: 'Science Explained',
    description: 'Scientific concepts made simple',
    styleBiblePrompt:
      'Scientific visualization style, space and cosmos imagery, molecular and atomic visuals, clean educational aesthetic, futuristic technology, nature documentray quality',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT,
    hookRules: [
      'Start with a mind-bending question',
      'Challenge intuition about reality',
      'Reference cutting-edge discoveries',
      'Promise to explain the unexplainable',
      'Use scale and perspective hooks',
    ],
    scenePacing: {
      60: { minScenes: 5, maxScenes: 7, minDurationSec: 7, maxDurationSec: 14 },
      90: { minScenes: 7, maxScenes: 9, minDurationSec: 8, maxDurationSec: 15 },
      120: { minScenes: 9, maxScenes: 11, minDurationSec: 9, maxDurationSec: 16 },
      180: { minScenes: 11, maxScenes: 14, minDurationSec: 10, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#00BFFF',
      highlightColor: '#FFD700',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'fade', 'pan_left', 'pan_right'],
      defaultEffect: 'slow_zoom_in',
    },
  },
  {
    id: 'mystery',
    name: 'Mysteries & Unexplained',
    description: 'Unsolved mysteries and phenomena',
    styleBiblePrompt:
      'Mysterious and enigmatic style, dark atmospheric lighting, fog and shadows, ancient artifacts, unexplained phenomena visuals, documentary mystery aesthetic',
    globalNegativePrompt: DEFAULT_NEGATIVE_PROMPT + ', cartoon, anime, bright happy colors',
    hookRules: [
      'Start with an unsolved question',
      'Reference specific mysterious events',
      'Create immediate intrigue',
      'Promise hidden knowledge',
      'Use conspiracy-adjacent language carefully',
    ],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 8, minDurationSec: 6, maxDurationSec: 12 },
      90: { minScenes: 8, maxScenes: 10, minDurationSec: 7, maxDurationSec: 14 },
      120: { minScenes: 10, maxScenes: 12, minDurationSec: 8, maxDurationSec: 15 },
      180: { minScenes: 12, maxScenes: 16, minDurationSec: 9, maxDurationSec: 18 },
    },
    captionStyle: {
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: '#9966FF',
      highlightColor: '#FFFFFF',
    },
    effectsProfile: {
      allowedEffects: ['slow_zoom_in', 'slow_zoom_out', 'fade', 'glitch'],
      defaultEffect: 'slow_zoom_in',
    },
  },
];

export function getNichePack(id: string): NichePack | undefined {
  return NICHE_PACKS.find((pack) => pack.id === id);
}

export function getScenePacing(pack: NichePack, targetLengthSec: number): ScenePacing {
  if (targetLengthSec <= 60) return pack.scenePacing[60];
  if (targetLengthSec <= 90) return pack.scenePacing[90];
  if (targetLengthSec <= 120) return pack.scenePacing[120];
  return pack.scenePacing[180];
}
