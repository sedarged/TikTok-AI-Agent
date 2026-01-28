import crypto from 'node:crypto';
import type OpenAI from 'openai';
import { prisma } from '../../db/prisma.js';
import { env } from '../../env.js';
import { getOpenAIClientOrThrow } from '../providers/openaiClient.js';
import type { NichePackConfig } from './packs.js';
import type { EffectPreset } from './types.js';

const EffectPresetEnum: EffectPreset[] = [
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
  'flash_cut',
  'fade',
  'glitch'
];

export async function regenerateScene(args: {
  pack: { id: string; title: string; config: NichePackConfig };
  project: { id: string; title: string; language: string; targetLengthSec: number; tempo: string };
  plan: { id: string; outline: string; hookSelected: string };
  scene: {
    id: string;
    idx: number;
    narrationText: string;
    onScreenText: string;
    visualPrompt: string;
    negativePrompt: string;
    effectPreset: string;
    durationTargetSec: number;
  };
}) {
  if (!env.OPENAI_API_KEY) {
    // Deterministic local regen: shuffle prompts slightly.
    const stamp = crypto.createHash('sha1').update(`${args.project.title}|${args.scene.idx}|${Date.now()}`).digest('hex').slice(0, 6);
    return await prisma.scene.update({
      where: { id: args.scene.id },
      data: {
        narrationText: `${args.scene.narrationText} (alt ${stamp})`,
        onScreenText: args.scene.onScreenText,
        visualPrompt: `${args.scene.visualPrompt} Variation ${stamp}.`,
        negativePrompt: args.scene.negativePrompt,
        effectPreset: args.scene.effectPreset
      }
    });
  }

  const client = getOpenAIClientOrThrow();
  const updated = await regenWithOpenAI(client, args);
  return await prisma.scene.update({
    where: { id: args.scene.id },
    data: {
      narrationText: updated.narrationText,
      onScreenText: updated.onScreenText,
      visualPrompt: updated.visualPrompt,
      negativePrompt: updated.negativePrompt ?? '',
      effectPreset: updated.effectPreset,
      durationTargetSec: updated.durationTargetSec
    }
  });
}

async function regenWithOpenAI(
  client: OpenAI,
  args: {
    pack: { id: string; title: string; config: NichePackConfig };
    project: { title: string; language: string; targetLengthSec: number; tempo: string };
    plan: { outline: string; hookSelected: string };
    scene: { idx: number; durationTargetSec: number; narrationText: string; onScreenText: string; visualPrompt: string; negativePrompt: string; effectPreset: string };
  }
) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['narrationText', 'onScreenText', 'visualPrompt', 'negativePrompt', 'effectPreset', 'durationTargetSec'],
    properties: {
      narrationText: { type: 'string', minLength: 4 },
      onScreenText: { type: 'string', minLength: 2 },
      visualPrompt: { type: 'string', minLength: 10 },
      negativePrompt: { type: 'string' },
      effectPreset: { type: 'string', enum: EffectPresetEnum },
      durationTargetSec: { type: 'number', minimum: Math.max(2, args.scene.durationTargetSec - 2), maximum: args.scene.durationTargetSec + 2 }
    }
  } as const;

  const prompt = [
    `Regenerate ONLY scene idx=${args.scene.idx} for a vertical video plan.`,
    `Output JSON only matching schema.`,
    `Keep style consistent with niche pack and outline. Do not reference brands/copyrighted characters/celebrities.`,
    `Language: ${args.project.language}`,
    `Selected hook: ${args.plan.hookSelected}`,
    `Outline:\n${args.plan.outline}`,
    `Pack style bible: ${args.pack.config.styleBiblePrompt}`,
    `Global negative prompt: ${args.pack.config.globalNegativePrompt}`,
    `Scene constraints: keep duration ~${args.scene.durationTargetSec}s and keep effectPreset within allowed.`,
    `Current scene:\n${JSON.stringify(args.scene, null, 2)}`
  ].join('\n');

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    messages: [
      { role: 'system', content: 'You output only JSON. No markdown. No extra keys.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'regen_scene', schema, strict: true } } as any
  });
  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response.');
  return JSON.parse(content) as {
    narrationText: string;
    onScreenText: string;
    visualPrompt: string;
    negativePrompt: string;
    effectPreset: EffectPreset;
    durationTargetSec: number;
  };
}

