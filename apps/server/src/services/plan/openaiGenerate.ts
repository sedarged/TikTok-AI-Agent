import type OpenAI from 'openai';
import type { EffectPreset, ProjectSettings, Scene } from './types.js';
import type { NichePackConfig } from './packs.js';
import { pacingBucket } from './packs.js';

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

export async function generateHooksOpenAI(client: OpenAI, settings: ProjectSettings, pack: { id: string; title: string; config: NichePackConfig }) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['hookOptions'],
    properties: {
      hookOptions: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: { type: 'string', minLength: 4 }
      }
    }
  } as const;

  const prompt = [
    `You are writing TikTok hooks.`,
    `Rules: no brands, no copyrighted characters, no real celebrity names, no hate/harassment. Keep it punchy.`,
    `Language: ${settings.language}.`,
    `Topic: ${settings.topic}.`,
    `Niche pack: ${pack.title} (${pack.id}).`,
    `Hook rules:`,
    ...pack.config.hookRules.map((r) => `- ${r}`)
  ].join('\n');

  const out = await callJson(client, 'hooks', schema, prompt);
  return out.hookOptions as [string, string, string, string, string];
}

export async function generateOutlineAndScenesOpenAI(
  client: OpenAI,
  settings: ProjectSettings,
  hookSelected: string,
  pack: { id: string; title: string; config: NichePackConfig }
) {
  const bucket = pacingBucket(settings.targetLengthSec);
  const pacing = pack.config.scenePacing[bucket];

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['outline', 'scenes'],
    properties: {
      outline: { type: 'string', minLength: 40 },
      scenes: {
        type: 'array',
        minItems: pacing.minScenes,
        maxItems: pacing.maxScenes,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['narrationText', 'onScreenText', 'visualPrompt', 'negativePrompt', 'effectPreset', 'durationTargetSec'],
          properties: {
            narrationText: { type: 'string', minLength: 4 },
            onScreenText: { type: 'string', minLength: 2 },
            visualPrompt: { type: 'string', minLength: 10 },
            negativePrompt: { type: 'string' },
            effectPreset: { type: 'string', enum: EffectPresetEnum },
            durationTargetSec: { type: 'number', minimum: pacing.minDur, maximum: pacing.maxDur }
          }
        }
      }
    }
  } as const;

  const prompt = [
    `You are generating a short-form vertical video plan.`,
    `Output must be valid JSON ONLY matching the provided schema. No markdown.`,
    `Constraints:`,
    `- No brands, no copyrighted characters, no real celebrity names.`,
    `- Keep content educational/fictional as appropriate for the niche pack.`,
    `- Respect pacing: targetLengthSec=${settings.targetLengthSec} tempo=${settings.tempo} scenes within ${pacing.minScenes}-${pacing.maxScenes}, per-scene duration ${pacing.minDur}-${pacing.maxDur}.`,
    `- Visual prompts must describe AI-generated imagery (no stock, no real photos).`,
    ``,
    `Language: ${settings.language}`,
    `Topic: ${settings.topic}`,
    `Selected hook: ${hookSelected}`,
    `Pack style bible (global): ${pack.config.styleBiblePrompt}`,
    `Global negative prompt: ${pack.config.globalNegativePrompt}`,
    `Allowed effects: ${pack.config.effectsProfile.allowed.join(', ') || EffectPresetEnum.join(', ')}`,
    `Default effect: ${pack.config.effectsProfile.default}`
  ].join('\n');

  const out = await callJson(client, 'outline_scenes', schema, prompt);
  return out as { outline: string; scenes: Array<Omit<Scene, 'id' | 'idx' | 'lock'>> };
}

export async function generateFullScriptOpenAI(
  client: OpenAI,
  settings: ProjectSettings,
  hookSelected: string,
  outline: string,
  scenes: Scene[]
) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['scriptFull', 'scenes'],
    properties: {
      scriptFull: { type: 'string', minLength: 40 },
      scenes: {
        type: 'array',
        minItems: scenes.length,
        maxItems: scenes.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['idx', 'narrationText', 'onScreenText'],
          properties: {
            idx: { type: 'number' },
            narrationText: { type: 'string', minLength: 4 },
            onScreenText: { type: 'string', minLength: 2 }
          }
        }
      }
    }
  } as const;

  const prompt = [
    `Write a full script and refine per-scene narration based on the given scenes.`,
    `Output must be JSON ONLY matching schema.`,
    `Language: ${settings.language}`,
    `Target length sec: ${settings.targetLengthSec}, tempo: ${settings.tempo}`,
    `Selected hook: ${hookSelected}`,
    `Outline:\n${outline}`,
    `Scenes (do not change count; keep idx the same; keep on-screen text short):`,
    JSON.stringify(
      scenes.map((s) => ({ idx: s.idx, durationTargetSec: s.durationTargetSec, narrationText: s.narrationText, onScreenText: s.onScreenText })),
      null,
      2
    )
  ].join('\n');

  const out = await callJson(client, 'full_script', schema, prompt);
  return out as { scriptFull: string; scenes: Array<{ idx: number; narrationText: string; onScreenText: string }> };
}

async function callJson(client: OpenAI, name: string, schema: any, prompt: string) {
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'You output only JSON. No markdown. No extra keys.' },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name, schema, strict: true }
    } as any
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response.');
  return JSON.parse(content);
}

