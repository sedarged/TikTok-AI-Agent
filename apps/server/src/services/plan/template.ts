import crypto from 'node:crypto';
import type { EffectPreset, PlanVersionPayload, ProjectSettings, Scene } from './types.js';
import { pacingBucket, type NichePackConfig } from './packs.js';

function seededRand(seed: string) {
  let h = crypto.createHash('sha256').update(seed).digest();
  let idx = 0;
  return () => {
    if (idx >= h.length - 4) {
      h = crypto.createHash('sha256').update(h).digest();
      idx = 0;
    }
    const n = h.readUInt32LE(idx);
    idx += 4;
    return n / 0xffffffff;
  };
}

const EFFECTS: EffectPreset[] = [
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

export function generateTemplatePlan(settings: ProjectSettings, pack: { id: string; title: string; config: NichePackConfig }): PlanVersionPayload {
  const rand = seededRand(`${settings.topic}|${settings.nichePackId}|${settings.language}|${settings.targetLengthSec}|${settings.tempo}`);
  const bucket = pacingBucket(settings.targetLengthSec);
  const pacing = pack.config.scenePacing[bucket];
  const sceneCount = Math.round(pacing.minScenes + (pacing.maxScenes - pacing.minScenes) * 0.65);

  const baseHook = `You won’t believe this about ${sanitize(settings.topic)}…`;
  const hookOptions = [
    baseHook,
    `Stop scrolling: ${sanitize(settings.topic)} has a hidden twist.`,
    `Quick question: what if ${sanitize(settings.topic)} is backwards?`,
    `Here’s the truth about ${sanitize(settings.topic)} in 60 seconds.`,
    `Most people get ${sanitize(settings.topic)} wrong. Here’s why.`
  ] as const;

  const hookSelected = hookOptions[Math.floor(rand() * hookOptions.length)]!;

  const outlineLines: string[] = [];
  outlineLines.push(`Hook: ${hookSelected}`);
  outlineLines.push(`Context: define the topic in one sentence.`);
  outlineLines.push(`Core: ${sceneCount - 2} punchy beats with one clear takeaway each.`);
  outlineLines.push(`Close: recap + one actionable next step.`);
  const outline = outlineLines.join('\n');

  const dur = settings.targetLengthSec / sceneCount;
  const scenes: Scene[] = Array.from({ length: sceneCount }).map((_, i) => {
    const effect = (pack.config.effectsProfile.allowed.length
      ? (pack.config.effectsProfile.allowed[Math.floor(rand() * pack.config.effectsProfile.allowed.length)] as EffectPreset)
      : EFFECTS[Math.floor(rand() * EFFECTS.length)]!) as EffectPreset;

    const beat = i === 0 ? 'Hook beat' : i === sceneCount - 1 ? 'Closing beat' : `Beat ${i + 1}`;
    const narrationText =
      i === 0
        ? hookSelected
        : i === sceneCount - 1
          ? `So that’s ${sanitize(settings.topic)}—save this and try one small step today.`
          : `Here’s ${beat.toLowerCase()}: one key point about ${sanitize(settings.topic)} with a simple example.`;
    const onScreenText =
      i === 0 ? shortCaps(hookSelected) : i === sceneCount - 1 ? 'TRY THIS TODAY' : `POINT ${i}`;
    const visualPrompt =
      i === 0
        ? `A striking opening visual representing: ${sanitize(settings.topic)}.`
        : i === sceneCount - 1
          ? `A satisfying conclusion visual representing clarity and action for: ${sanitize(settings.topic)}.`
          : `A clear visual metaphor for ${sanitize(settings.topic)} focusing on ${beat.toLowerCase()}.`;

    return {
      id: crypto.randomUUID(),
      idx: i,
      narrationText,
      onScreenText,
      visualPrompt,
      negativePrompt: '',
      effectPreset: effect,
      durationTargetSec: dur,
      lock: false
    };
  });

  const wpm = settings.tempo === 'slow' ? 140 : settings.tempo === 'fast' ? 190 : 165;
  const words = scenes.map((s) => s.narrationText).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const estimatedLengthSec = Math.round((words / wpm) * 60);

  return {
    hookOptions: [...hookOptions] as any,
    hookSelected,
    outline,
    scriptFull: scenes.map((s) => s.narrationText).join('\n'),
    scenes,
    estimates: { wpm, estimatedLengthSec, targetLengthSec: settings.targetLengthSec },
    validation: { errors: [], warnings: ['Template mode: OpenAI not configured.'], suggestions: ['Add OPENAI_API_KEY to enable AI planning and rendering.'] }
  };
}

function sanitize(s: string) {
  return String(s || '').replace(/[^\p{L}\p{N}\s.,!?'"-]/gu, '').trim();
}

function shortCaps(s: string) {
  const t = sanitize(s).toUpperCase();
  return t.length > 42 ? `${t.slice(0, 39)}…` : t;
}

