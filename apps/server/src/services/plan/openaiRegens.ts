import type OpenAI from 'openai';
import type { Scene } from './types.js';

export async function regenerateHooksOnly(client: OpenAI, args: { topic: string; language: string; hookRules: string[] }) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['hookOptions'],
    properties: {
      hookOptions: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string', minLength: 4 } }
    }
  } as const;

  const prompt = [
    `Generate exactly 5 new hook options.`,
    `Output JSON only.`,
    `No brands, no copyrighted characters, no celebrity names.`,
    `Language: ${args.language}`,
    `Topic: ${args.topic}`,
    `Hook rules:\n${args.hookRules.map((r) => `- ${r}`).join('\n')}`
  ].join('\n');

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.9,
    messages: [
      { role: 'system', content: 'You output only JSON. No markdown. No extra keys.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'regen_hooks', schema, strict: true } } as any
  });
  return JSON.parse(resp.choices[0]?.message?.content || '{}') as { hookOptions: [string, string, string, string, string] };
}

export async function regenerateOutlineOnly(
  client: OpenAI,
  args: { topic: string; language: string; hookSelected: string; sceneHeadlines: Array<{ idx: number; onScreenText: string }> }
) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['outline'],
    properties: { outline: { type: 'string', minLength: 40 } }
  } as const;

  const prompt = [
    `Regenerate an improved outline for this short-form vertical video.`,
    `Output JSON only.`,
    `Language: ${args.language}`,
    `Topic: ${args.topic}`,
    `Selected hook: ${args.hookSelected}`,
    `Scene headlines:\n${JSON.stringify(args.sceneHeadlines, null, 2)}`
  ].join('\n');

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'You output only JSON. No markdown. No extra keys.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'regen_outline', schema, strict: true } } as any
  });
  return JSON.parse(resp.choices[0]?.message?.content || '{}') as { outline: string };
}

export async function regenerateScriptOnly(
  client: OpenAI,
  args: { topic: string; language: string; targetLengthSec: number; tempo: string; hookSelected: string; outline: string; scenes: Scene[] }
) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['scriptFull', 'scenes'],
    properties: {
      scriptFull: { type: 'string', minLength: 40 },
      scenes: {
        type: 'array',
        minItems: args.scenes.length,
        maxItems: args.scenes.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'narrationText', 'onScreenText'],
          properties: {
            id: { type: 'string' },
            narrationText: { type: 'string', minLength: 4 },
            onScreenText: { type: 'string', minLength: 2 }
          }
        }
      }
    }
  } as const;

  const prompt = [
    `Regenerate the full script and refine per-scene narration.`,
    `Output JSON only.`,
    `Language: ${args.language}`,
    `Topic: ${args.topic}`,
    `Target length sec: ${args.targetLengthSec}`,
    `Tempo: ${args.tempo}`,
    `Selected hook: ${args.hookSelected}`,
    `Outline:\n${args.outline}`,
    `Scenes (do not change count; do not change ids; do not edit locked scenes):`,
    JSON.stringify(
      args.scenes.map((s) => ({
        id: s.id,
        idx: s.idx,
        lock: s.lock,
        durationTargetSec: s.durationTargetSec,
        narrationText: s.narrationText,
        onScreenText: s.onScreenText
      })),
      null,
      2
    )
  ].join('\n');

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    messages: [
      { role: 'system', content: 'You output only JSON. No markdown. No extra keys.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'regen_script', schema, strict: true } } as any
  });
  return JSON.parse(resp.choices[0]?.message?.content || '{}') as {
    scriptFull: string;
    scenes: Array<{ id: string; narrationText: string; onScreenText: string }>;
  };
}

