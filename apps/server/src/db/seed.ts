import { prisma } from './prisma.js';

type ScenePacing = {
  minScenes: number;
  maxScenes: number;
  minDur: number;
  maxDur: number;
};

type NichePackConfig = {
  styleBiblePrompt: string;
  globalNegativePrompt: string;
  hookRules: string[];
  scenePacing: Record<'60' | '90' | '120' | '180', ScenePacing>;
  captionStyle: {
    font: string;
    size: number;
    outline: number;
    highlightMode: 'word' | 'segment';
    safeMarginPct: number;
  };
  effectsProfile: {
    allowed: string[];
    default: string;
  };
};

const packs: Array<{ id: string; title: string; config: NichePackConfig }> = [
  {
    id: 'horror',
    title: 'Horror',
    config: {
      styleBiblePrompt:
        'Cinematic horror still frame, moody lighting, high contrast, subtle film grain, shallow depth of field, dramatic shadows, 9:16 composition.',
      globalNegativePrompt:
        'no gore, no blood, no excessive violence, no real people likeness, no celebrities, no logos, no text, no watermark',
      hookRules: [
        'Start with a creepy question in under 2 seconds.',
        'Use short sentences and escalating tension.',
        'Avoid real locations/brands; keep it fictional.'
      ],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 8, minDur: 5, maxDur: 10 },
        '90': { minScenes: 8, maxScenes: 10, minDur: 6, maxDur: 12 },
        '120': { minScenes: 10, maxScenes: 12, minDur: 7, maxDur: 14 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 9, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 64, outline: 6, highlightMode: 'word', safeMarginPct: 8 },
      effectsProfile: {
        allowed: ['slow_zoom_in', 'pan_left', 'pan_right', 'tilt_down', 'glitch', 'flash_cut', 'fade'],
        default: 'slow_zoom_in'
      }
    }
  },
  {
    id: 'facts',
    title: 'Facts',
    config: {
      styleBiblePrompt:
        'High-clarity educational infographic style, bold shapes, clean gradients, vibrant but readable colors, 9:16 composition, crisp details.',
      globalNegativePrompt: 'no logos, no watermark, no tiny unreadable text, no brand names, no real people likeness',
      hookRules: ['Use a surprising statistic or claim.', 'Promise a payoff within 10 seconds.', 'Keep language simple.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 9, minDur: 4, maxDur: 9 },
        '90': { minScenes: 8, maxScenes: 11, minDur: 5, maxDur: 10 },
        '120': { minScenes: 10, maxScenes: 13, minDur: 6, maxDur: 12 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 8, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 66, outline: 6, highlightMode: 'word', safeMarginPct: 7 },
      effectsProfile: {
        allowed: ['slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'fade', 'flash_cut'],
        default: 'slow_zoom_in'
      }
    }
  },
  {
    id: 'motivation',
    title: 'Motivation',
    config: {
      styleBiblePrompt:
        'Uplifting cinematic photography, warm sunrise lighting, inspiring mood, shallow depth of field, soft bokeh, 9:16 vertical composition.',
      globalNegativePrompt: 'no logos, no watermark, no text, no brand names, no celebrities',
      hookRules: ['Start with a bold challenge statement.', 'Use rhythmic short lines.', 'End with a call-to-action.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 8, minDur: 5, maxDur: 10 },
        '90': { minScenes: 8, maxScenes: 10, minDur: 6, maxDur: 12 },
        '120': { minScenes: 10, maxScenes: 12, minDur: 7, maxDur: 14 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 9, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 68, outline: 7, highlightMode: 'segment', safeMarginPct: 8 },
      effectsProfile: { allowed: ['slow_zoom_in', 'slow_zoom_out', 'fade'], default: 'slow_zoom_in' }
    }
  },
  {
    id: 'product',
    title: 'Product',
    config: {
      styleBiblePrompt:
        'Clean product photography style, studio lighting, sharp focus, minimal background, modern aesthetic, 9:16 composition.',
      globalNegativePrompt: 'no brand logos, no watermark, no copyrighted product shapes, no celebrity likeness',
      hookRules: ['Lead with the pain point.', 'Show benefit quickly.', 'Use clear, practical wording.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 9, minDur: 4, maxDur: 10 },
        '90': { minScenes: 8, maxScenes: 11, minDur: 5, maxDur: 11 },
        '120': { minScenes: 10, maxScenes: 13, minDur: 6, maxDur: 12 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 8, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 62, outline: 6, highlightMode: 'segment', safeMarginPct: 7 },
      effectsProfile: { allowed: ['slow_zoom_in', 'pan_left', 'pan_right', 'fade', 'flash_cut'], default: 'slow_zoom_in' }
    }
  },
  {
    id: 'story',
    title: 'Story',
    config: {
      styleBiblePrompt:
        'Cinematic storytelling still frame, natural lighting, expressive composition, filmic color grading, 9:16 vertical.',
      globalNegativePrompt: 'no logos, no watermark, no explicit violence, no real person likeness, no celebrities',
      hookRules: ['Open mid-action.', 'Use cliffhangers between scenes.', 'Keep continuity consistent.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 8, minDur: 5, maxDur: 10 },
        '90': { minScenes: 8, maxScenes: 10, minDur: 6, maxDur: 12 },
        '120': { minScenes: 10, maxScenes: 12, minDur: 7, maxDur: 14 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 9, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 64, outline: 6, highlightMode: 'word', safeMarginPct: 8 },
      effectsProfile: { allowed: ['slow_zoom_in', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'fade'], default: 'slow_zoom_in' }
    }
  },
  {
    id: 'top5',
    title: 'Top 5',
    config: {
      styleBiblePrompt:
        'Bold listicle graphics, big readable shapes, high contrast, vibrant palette, clean layout, 9:16 vertical composition.',
      globalNegativePrompt: 'no logos, no watermark, no tiny text, no brands, no celebrity likeness',
      hookRules: ['Promise a ranked list.', 'Tease the #1 item.', 'Keep each item punchy.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 9, minDur: 4, maxDur: 9 },
        '90': { minScenes: 8, maxScenes: 11, minDur: 5, maxDur: 10 },
        '120': { minScenes: 10, maxScenes: 13, minDur: 6, maxDur: 12 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 8, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 66, outline: 6, highlightMode: 'segment', safeMarginPct: 7 },
      effectsProfile: { allowed: ['flash_cut', 'fade', 'slow_zoom_in', 'pan_left', 'pan_right'], default: 'flash_cut' }
    }
  },
  {
    id: 'finance_tips',
    title: 'Finance Tips (educational)',
    config: {
      styleBiblePrompt:
        'Clean educational finance visuals, charts and icons style, modern minimal design, 9:16 vertical composition.',
      globalNegativePrompt: 'no financial advice disclaimers as text, no logos, no watermark, no brand names',
      hookRules: ['Avoid guarantees and hype.', 'Use educational framing.', 'Keep tips actionable and safe.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 9, minDur: 4, maxDur: 9 },
        '90': { minScenes: 8, maxScenes: 11, minDur: 5, maxDur: 10 },
        '120': { minScenes: 10, maxScenes: 13, minDur: 6, maxDur: 12 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 8, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 62, outline: 6, highlightMode: 'word', safeMarginPct: 7 },
      effectsProfile: { allowed: ['slow_zoom_in', 'slow_zoom_out', 'fade', 'pan_left', 'pan_right'], default: 'slow_zoom_in' }
    }
  },
  {
    id: 'health_myths',
    title: 'Health Myths (educational)',
    config: {
      styleBiblePrompt:
        'Clean medical educational illustration style, soft gradients, clear icons, readable composition, 9:16 vertical.',
      globalNegativePrompt: 'no medical claims of cure, no logos, no watermark, no brands',
      hookRules: ['Frame as myth vs fact.', 'Encourage consulting professionals.', 'Be cautious and educational.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 9, minDur: 4, maxDur: 9 },
        '90': { minScenes: 8, maxScenes: 11, minDur: 5, maxDur: 10 },
        '120': { minScenes: 10, maxScenes: 13, minDur: 6, maxDur: 12 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 8, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 62, outline: 6, highlightMode: 'word', safeMarginPct: 7 },
      effectsProfile: { allowed: ['fade', 'slow_zoom_in', 'pan_left', 'pan_right'], default: 'fade' }
    }
  },
  {
    id: 'history',
    title: 'History',
    config: {
      styleBiblePrompt:
        'Historical illustration / archival-inspired look, sepia tones, textured paper feel, cinematic lighting, 9:16 vertical.',
      globalNegativePrompt: 'no real photographs, no logos, no watermark, no modern brand names',
      hookRules: ['Open with a surprising historical detail.', 'Keep timelines clear.', 'Avoid real quotes attribution.'],
      scenePacing: {
        '60': { minScenes: 6, maxScenes: 8, minDur: 5, maxDur: 10 },
        '90': { minScenes: 8, maxScenes: 10, minDur: 6, maxDur: 12 },
        '120': { minScenes: 10, maxScenes: 12, minDur: 7, maxDur: 14 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 9, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 64, outline: 6, highlightMode: 'segment', safeMarginPct: 8 },
      effectsProfile: { allowed: ['slow_zoom_in', 'tilt_up', 'tilt_down', 'fade'], default: 'slow_zoom_in' }
    }
  },
  {
    id: 'gaming',
    title: 'Gaming',
    config: {
      styleBiblePrompt:
        'High-energy gaming thumbnail art style, neon lighting, dynamic composition, bold color grading, 9:16 vertical.',
      globalNegativePrompt: 'no real game logos, no copyrighted characters, no watermark, no brands',
      hookRules: ['Start with a challenge or twist.', 'Keep pacing fast.', 'Use hype but avoid brand references.'],
      scenePacing: {
        '60': { minScenes: 7, maxScenes: 10, minDur: 4, maxDur: 8 },
        '90': { minScenes: 9, maxScenes: 12, minDur: 5, maxDur: 9 },
        '120': { minScenes: 11, maxScenes: 14, minDur: 6, maxDur: 10 },
        '180': { minScenes: 12, maxScenes: 14, minDur: 8, maxDur: 16 }
      },
      captionStyle: { font: 'Arial Black', size: 66, outline: 7, highlightMode: 'word', safeMarginPct: 7 },
      effectsProfile: { allowed: ['flash_cut', 'glitch', 'pan_left', 'pan_right', 'slow_zoom_in'], default: 'glitch' }
    }
  }
];

async function main() {
  for (const p of packs) {
    await prisma.nichePack.upsert({
      where: { id: p.id },
      update: { title: p.title, configJson: JSON.stringify(p.config) },
      create: { id: p.id, title: p.title, configJson: JSON.stringify(p.config) }
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${packs.length} niche packs.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

