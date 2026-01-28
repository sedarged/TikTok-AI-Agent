export interface NichePack {
  id: string;
  label: string;
  styleBiblePrompt: string;
  globalNegativePrompt: string;
  hookRules: string[];
  scenePacing: {
    60: PacingConfig;
    90: PacingConfig;
    120: PacingConfig;
    180: PacingConfig;
  };
  captionStyle: {
    font: string;
    size: number;
    outline: number;
    highlightMode: 'word' | 'segment';
    safeMargins: boolean;
  };
  effectsProfile: {
    allowed: string[];
    default: string;
  };
}

interface PacingConfig {
  minScenes: number;
  maxScenes: number;
  minDur: number;
  maxDur: number;
}

export const NICHE_PACKS: Record<string, NichePack> = {
  horror: {
    id: 'horror',
    label: 'Horror / Spooky',
    styleBiblePrompt: 'dark, atmospheric, cinematic horror, eerie lighting, high contrast, 8k, unreal engine 5 render, scary, suspenseful',
    globalNegativePrompt: 'bright, cheerful, cartoon, low resolution, blurry, watermark',
    hookRules: ['Must be a scary question', 'Start with a shocking statement'],
    scenePacing: {
      60: { minScenes: 8, maxScenes: 12, minDur: 3, maxDur: 8 },
      90: { minScenes: 12, maxScenes: 18, minDur: 3, maxDur: 8 },
      120: { minScenes: 16, maxScenes: 24, minDur: 3, maxDur: 8 },
      180: { minScenes: 24, maxScenes: 30, minDur: 3, maxDur: 8 },
    },
    captionStyle: { font: 'Creepster', size: 60, outline: 4, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['slow_zoom_in', 'glitch', 'flash_cut'], default: 'slow_zoom_in' },
  },
  facts: {
    id: 'facts',
    label: 'Crazy Facts',
    styleBiblePrompt: 'high definition, realistic, educational, clear focus, detailed, national geographic style',
    globalNegativePrompt: 'abstract, distorted, text, watermark',
    hookRules: ['Did you know...', 'You won\'t believe...'],
    scenePacing: {
      60: { minScenes: 10, maxScenes: 15, minDur: 2, maxDur: 6 },
      90: { minScenes: 15, maxScenes: 22, minDur: 2, maxDur: 6 },
      120: { minScenes: 20, maxScenes: 30, minDur: 2, maxDur: 6 },
      180: { minScenes: 30, maxScenes: 45, minDur: 2, maxDur: 6 },
    },
    captionStyle: { font: 'Montserrat', size: 55, outline: 3, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['pan_left', 'pan_right', 'slow_zoom_in'], default: 'pan_left' },
  },
  motivation: {
    id: 'motivation',
    label: 'Motivation / Stoic',
    styleBiblePrompt: 'cinematic, moody, inspirational, statues, ancient rome, gym, workout, golden hour, heroic',
    globalNegativePrompt: 'weak, cartoon, ugly',
    hookRules: ['Stop doing this...', 'The secret to...'],
    scenePacing: {
      60: { minScenes: 6, maxScenes: 10, minDur: 4, maxDur: 10 },
      90: { minScenes: 9, maxScenes: 15, minDur: 4, maxDur: 10 },
      120: { minScenes: 12, maxScenes: 20, minDur: 4, maxDur: 10 },
      180: { minScenes: 18, maxScenes: 30, minDur: 4, maxDur: 10 },
    },
    captionStyle: { font: 'Roboto', size: 60, outline: 3, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['slow_zoom_in', 'slow_zoom_out'], default: 'slow_zoom_in' },
  },
  product: {
    id: 'product',
    label: 'Product Showcase',
    styleBiblePrompt: 'clean, studio lighting, product photography, 4k, advertising style',
    globalNegativePrompt: 'dark, dirty, blurry',
    hookRules: ['This gadget changes everything', 'Best amazon find'],
    scenePacing: {
      60: { minScenes: 10, maxScenes: 20, minDur: 2, maxDur: 5 },
      90: { minScenes: 15, maxScenes: 30, minDur: 2, maxDur: 5 },
      120: { minScenes: 20, maxScenes: 40, minDur: 2, maxDur: 5 },
      180: { minScenes: 30, maxScenes: 60, minDur: 2, maxDur: 5 },
    },
    captionStyle: { font: 'Arial', size: 50, outline: 2, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['pan_left', 'pan_right', 'zoom_in'], default: 'zoom_in' },
  },
  story: {
    id: 'story',
    label: 'Storytime',
    styleBiblePrompt: 'narrative, illustrative, detailed, dramatic lighting, storybook style or realistic reenactment',
    globalNegativePrompt: 'boring, static',
    hookRules: ['I almost died when...', 'My ex did this...'],
    scenePacing: {
      60: { minScenes: 8, maxScenes: 12, minDur: 3, maxDur: 8 },
      90: { minScenes: 12, maxScenes: 18, minDur: 3, maxDur: 8 },
      120: { minScenes: 16, maxScenes: 24, minDur: 3, maxDur: 8 },
      180: { minScenes: 24, maxScenes: 36, minDur: 3, maxDur: 8 },
    },
    captionStyle: { font: 'Comic Sans MS', size: 55, outline: 3, highlightMode: 'segment', safeMargins: true },
    effectsProfile: { allowed: ['slow_zoom_in', 'pan_right'], default: 'slow_zoom_in' },
  },
  top5: {
    id: 'top5',
    label: 'Top 5 List',
    styleBiblePrompt: 'infographic style, clear, listicle, vibrant colors',
    globalNegativePrompt: 'cluttered, confusing',
    hookRules: ['Top 5...', 'Ranking the best...'],
    scenePacing: {
      60: { minScenes: 10, maxScenes: 15, minDur: 3, maxDur: 6 },
      90: { minScenes: 15, maxScenes: 20, minDur: 3, maxDur: 6 },
      120: { minScenes: 20, maxScenes: 25, minDur: 3, maxDur: 6 },
      180: { minScenes: 25, maxScenes: 35, minDur: 3, maxDur: 6 },
    },
    captionStyle: { font: 'Impact', size: 60, outline: 3, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['slide_up', 'pan_left'], default: 'slide_up' },
  },
  finance_tips: {
    id: 'finance_tips',
    label: 'Finance Tips',
    styleBiblePrompt: 'professional, clean, business, money, charts, office, success',
    globalNegativePrompt: 'messy, poor quality',
    hookRules: ['Save money by...', 'Invest in...'],
    scenePacing: {
      60: { minScenes: 8, maxScenes: 12, minDur: 3, maxDur: 8 },
      90: { minScenes: 12, maxScenes: 18, minDur: 3, maxDur: 8 },
      120: { minScenes: 16, maxScenes: 24, minDur: 3, maxDur: 8 },
      180: { minScenes: 24, maxScenes: 36, minDur: 3, maxDur: 8 },
    },
    captionStyle: { font: 'Lato', size: 50, outline: 2, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['slow_zoom_out', 'pan_right'], default: 'slow_zoom_out' },
  },
  health_myths: {
    id: 'health_myths',
    label: 'Health Myths',
    styleBiblePrompt: 'medical, scientific, clean, bright, anatomical or fitness',
    globalNegativePrompt: 'gross, blood, gore',
    hookRules: ['Doctors don\'t want you to know...', 'Stop eating...'],
    scenePacing: {
      60: { minScenes: 8, maxScenes: 14, minDur: 3, maxDur: 7 },
      90: { minScenes: 12, maxScenes: 20, minDur: 3, maxDur: 7 },
      120: { minScenes: 16, maxScenes: 26, minDur: 3, maxDur: 7 },
      180: { minScenes: 24, maxScenes: 40, minDur: 3, maxDur: 7 },
    },
    captionStyle: { font: 'Open Sans', size: 50, outline: 2, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['slow_zoom_in', 'fade'], default: 'slow_zoom_in' },
  },
  history: {
    id: 'history',
    label: 'History Facts',
    styleBiblePrompt: 'vintage, sepia, historical painting style, realistic, detailed',
    globalNegativePrompt: 'modern, anachronistic, neon',
    hookRules: ['In 1945...', 'The truth about...'],
    scenePacing: {
      60: { minScenes: 8, maxScenes: 12, minDur: 4, maxDur: 8 },
      90: { minScenes: 12, maxScenes: 18, minDur: 4, maxDur: 8 },
      120: { minScenes: 16, maxScenes: 24, minDur: 4, maxDur: 8 },
      180: { minScenes: 24, maxScenes: 36, minDur: 4, maxDur: 8 },
    },
    captionStyle: { font: 'Cinzel', size: 55, outline: 3, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['slow_zoom_in', 'pan_left'], default: 'slow_zoom_in' },
  },
  gaming: {
    id: 'gaming',
    label: 'Gaming News/Facts',
    styleBiblePrompt: 'cyberpunk, neon, digital art, high tech, futuristic, 8k render',
    globalNegativePrompt: 'dull, vintage, rustic',
    hookRules: ['GTA 6 just...', 'The secret level in...'],
    scenePacing: {
      60: { minScenes: 12, maxScenes: 20, minDur: 2, maxDur: 5 },
      90: { minScenes: 18, maxScenes: 30, minDur: 2, maxDur: 5 },
      120: { minScenes: 24, maxScenes: 40, minDur: 2, maxDur: 5 },
      180: { minScenes: 36, maxScenes: 60, minDur: 2, maxDur: 5 },
    },
    captionStyle: { font: 'Press Start 2P', size: 40, outline: 3, highlightMode: 'word', safeMargins: true },
    effectsProfile: { allowed: ['glitch', 'flash_cut', 'zoom_in'], default: 'glitch' },
  },
};
