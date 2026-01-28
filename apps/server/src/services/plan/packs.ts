import { prisma } from '../../db/prisma.js';

export type ScenePacing = { minScenes: number; maxScenes: number; minDur: number; maxDur: number };

export type NichePackConfig = {
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

export async function getNichePackOrThrow(nichePackId: string) {
  const pack = await prisma.nichePack.findUnique({ where: { id: nichePackId } });
  if (!pack) throw new Error(`Unknown nichePackId: ${nichePackId}`);
  const config = JSON.parse(pack.configJson) as NichePackConfig;
  return { id: pack.id, title: pack.title, config };
}

export function pacingBucket(targetLengthSec: number): '60' | '90' | '120' | '180' {
  if (targetLengthSec >= 180) return '180';
  if (targetLengthSec >= 120) return '120';
  if (targetLengthSec >= 90) return '90';
  return '60';
}

