import fs from "fs/promises";
import path from "path";
import { config } from "../../env.js";

export type ScenePacing = {
  minScenes: number;
  maxScenes: number;
  minDur: number;
  maxDur: number;
};

export type CaptionStyle = {
  font: string;
  size: number;
  outline: number;
  highlightMode: "word" | "segment";
  safeMargins: { top: number; bottom: number; left: number; right: number };
};

export type EffectsProfile = {
  allowedEffects: EffectPreset[];
  defaultEffect: EffectPreset;
};

export type EffectPreset =
  | "slow_zoom_in"
  | "slow_zoom_out"
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  | "flash_cut"
  | "fade"
  | "glitch";

export type NichePack = {
  id: string;
  name: string;
  styleBiblePrompt: string;
  globalNegativePrompt: string;
  hookRules: string[];
  scenePacing: Record<"60" | "90" | "120" | "180", ScenePacing>;
  captionStyle: CaptionStyle;
  effectsProfile: EffectsProfile;
};

export type NichePackStore = {
  updatedAt: string;
  packs: NichePack[];
};

const PACKS_FILE = path.join(config.artifactsDir, "packs.json");

export const DEFAULT_PACKS: NichePack[] = [
  {
    id: "horror",
    name: "Horror",
    styleBiblePrompt:
      "Cinematic horror visuals, high contrast, eerie shadows, moody lighting, film grain, suspenseful atmosphere.",
    globalNegativePrompt:
      "cartoon, childish, low contrast, bright cheerful colors, gore, graphic violence, text, watermark",
    hookRules: [
      "Start with a chilling question.",
      "Use short suspenseful lines.",
      "Avoid graphic descriptions.",
      "Build tension with pacing.",
      "End hook with a cliffhanger."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 54,
      outline: 4,
      highlightMode: "word",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "slow_zoom_out",
        "pan_left",
        "pan_right",
        "tilt_up",
        "tilt_down",
        "flash_cut",
        "fade",
        "glitch"
      ],
      defaultEffect: "slow_zoom_in"
    }
  },
  {
    id: "facts",
    name: "Facts",
    styleBiblePrompt:
      "Clean infographic-inspired visuals, crisp lighting, bold shapes, modern minimal design.",
    globalNegativePrompt:
      "blurry, low contrast, illegible text, watermark, logo, brand names",
    hookRules: [
      "Open with a surprising statistic.",
      "Keep sentences punchy.",
      "Avoid brand mentions.",
      "Make claims verifiable.",
      "End hook with curiosity gap."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 56,
      outline: 5,
      highlightMode: "word",
      safeMargins: { top: 110, bottom: 150, left: 110, right: 110 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "slow_zoom_out",
        "pan_left",
        "pan_right",
        "fade",
        "flash_cut"
      ],
      defaultEffect: "pan_left"
    }
  },
  {
    id: "motivation",
    name: "Motivation",
    styleBiblePrompt:
      "Inspiring cinematic visuals, sunrise lighting, wide vistas, energetic and uplifting mood.",
    globalNegativePrompt:
      "dark gloomy, low saturation, corporate logos, text, watermark",
    hookRules: [
      "Start with an empowering statement.",
      "Use rhythmic short sentences.",
      "Avoid clichés.",
      "Focus on action verbs.",
      "End hook with challenge."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 52,
      outline: 4,
      highlightMode: "word",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "pan_right",
        "tilt_up",
        "fade"
      ],
      defaultEffect: "slow_zoom_in"
    }
  },
  {
    id: "product",
    name: "Product Spotlight",
    styleBiblePrompt:
      "Clean product photography, soft studio lighting, modern minimal backgrounds, premium look.",
    globalNegativePrompt:
      "clutter, messy background, watermark, text overlays, brand logos",
    hookRules: [
      "Lead with a problem statement.",
      "Highlight a clear benefit.",
      "Avoid brand names.",
      "Keep it concise.",
      "End with curiosity about the solution."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 50,
      outline: 4,
      highlightMode: "segment",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "slow_zoom_out",
        "pan_left",
        "pan_right",
        "fade"
      ],
      defaultEffect: "slow_zoom_out"
    }
  },
  {
    id: "story",
    name: "Storytime",
    styleBiblePrompt:
      "Warm cinematic story visuals, soft lighting, shallow depth of field, emotive atmosphere.",
    globalNegativePrompt:
      "text, watermark, brand logos, low contrast, cartoon",
    hookRules: [
      "Start with a personal-sounding line.",
      "Use emotional language.",
      "Keep the hook under 12 words.",
      "Avoid brand references.",
      "End with curiosity."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 52,
      outline: 4,
      highlightMode: "word",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "pan_left",
        "pan_right",
        "fade"
      ],
      defaultEffect: "slow_zoom_in"
    }
  },
  {
    id: "top5",
    name: "Top 5",
    styleBiblePrompt:
      "Bold ranking visuals, clean gradients, spotlight lighting, high clarity.",
    globalNegativePrompt:
      "watermark, text blocks, cluttered background, brand logos",
    hookRules: [
      "Mention the list count upfront.",
      "Use excitement.",
      "Avoid brand mentions.",
      "Keep each item distinct.",
      "End hook with #1 tease."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 56,
      outline: 5,
      highlightMode: "segment",
      safeMargins: { top: 110, bottom: 150, left: 110, right: 110 }
    },
    effectsProfile: {
      allowedEffects: [
        "flash_cut",
        "pan_left",
        "pan_right",
        "slow_zoom_in",
        "fade"
      ],
      defaultEffect: "flash_cut"
    }
  },
  {
    id: "finance_tips",
    name: "Finance Tips",
    styleBiblePrompt:
      "Professional financial visuals, clean charts, muted tones, confident composition.",
    globalNegativePrompt:
      "get rich quick, gambling, logos, watermark, blurry",
    hookRules: [
      "Open with a practical tip.",
      "Emphasize education only.",
      "No financial promises.",
      "Use calm authority.",
      "End with a teaser."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 52,
      outline: 4,
      highlightMode: "segment",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "pan_right",
        "fade"
      ],
      defaultEffect: "slow_zoom_in"
    }
  },
  {
    id: "health_myths",
    name: "Health Myths",
    styleBiblePrompt:
      "Clean medical-style visuals, bright lighting, friendly trustworthy tone, soft gradients.",
    globalNegativePrompt:
      "medical claims, graphic imagery, logos, watermark, gore",
    hookRules: [
      "Start with a common myth.",
      "Emphasize educational tone.",
      "Avoid medical advice.",
      "Be concise.",
      "End with a fact tease."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 52,
      outline: 4,
      highlightMode: "word",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "slow_zoom_out",
        "fade"
      ],
      defaultEffect: "slow_zoom_in"
    }
  },
  {
    id: "history",
    name: "History",
    styleBiblePrompt:
      "Historical documentary visuals, sepia tones, textured film look, dramatic lighting.",
    globalNegativePrompt:
      "cartoon, text, watermark, brand logos, modern tech",
    hookRules: [
      "Start with a date or event.",
      "Keep it factual.",
      "Avoid modern brand references.",
      "Use narrative pacing.",
      "End with suspense."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 50,
      outline: 4,
      highlightMode: "segment",
      safeMargins: { top: 120, bottom: 160, left: 120, right: 120 }
    },
    effectsProfile: {
      allowedEffects: [
        "slow_zoom_in",
        "pan_left",
        "pan_right",
        "fade"
      ],
      defaultEffect: "slow_zoom_in"
    }
  },
  {
    id: "gaming",
    name: "Gaming",
    styleBiblePrompt:
      "High-energy gaming visuals, neon accents, dynamic lighting, futuristic tone.",
    globalNegativePrompt:
      "brand logos, watermark, text blocks, photoreal faces",
    hookRules: [
      "Open with a hype statement.",
      "Use action verbs.",
      "Avoid naming real games.",
      "Keep high tempo.",
      "End with a challenge."
    ],
    scenePacing: {
      "60": { minScenes: 6, maxScenes: 8, minDur: 6, maxDur: 10 },
      "90": { minScenes: 8, maxScenes: 10, minDur: 7, maxDur: 12 },
      "120": { minScenes: 10, maxScenes: 12, minDur: 8, maxDur: 13 },
      "180": { minScenes: 12, maxScenes: 14, minDur: 10, maxDur: 16 }
    },
    captionStyle: {
      font: "Arial Black",
      size: 56,
      outline: 5,
      highlightMode: "word",
      safeMargins: { top: 110, bottom: 150, left: 110, right: 110 }
    },
    effectsProfile: {
      allowedEffects: [
        "flash_cut",
        "glitch",
        "pan_left",
        "pan_right",
        "slow_zoom_in"
      ],
      defaultEffect: "glitch"
    }
  }
];

export async function ensureNichePacksFile() {
  await fs.mkdir(config.artifactsDir, { recursive: true });
  try {
    await fs.access(PACKS_FILE);
  } catch {
    const payload: NichePackStore = {
      updatedAt: new Date().toISOString(),
      packs: DEFAULT_PACKS
    };
    await fs.writeFile(PACKS_FILE, JSON.stringify(payload, null, 2), "utf8");
  }
}

export async function loadNichePacks(): Promise<NichePack[]> {
  await ensureNichePacksFile();
  const raw = await fs.readFile(PACKS_FILE, "utf8");
  const parsed = JSON.parse(raw) as NichePackStore;
  if (!parsed?.packs?.length) {
    return DEFAULT_PACKS;
  }
  return parsed.packs;
}

export async function getNichePack(id: string): Promise<NichePack | null> {
  const packs = await loadNichePacks();
  return packs.find((pack) => pack.id === id) ?? null;
}

export async function updateNichePack(
  id: string,
  patch: Partial<NichePack>
): Promise<NichePack | null> {
  const packs = await loadNichePacks();
  const idx = packs.findIndex((pack) => pack.id === id);
  if (idx === -1) return null;
  const updated = { ...packs[idx], ...patch, id };
  packs[idx] = updated;
  const payload: NichePackStore = {
    updatedAt: new Date().toISOString(),
    packs
  };
  await fs.writeFile(PACKS_FILE, JSON.stringify(payload, null, 2), "utf8");
  return updated;
}
