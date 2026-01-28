import crypto from 'node:crypto';
import type { PlanVersionPayload, ProjectSettings, Scene } from './types.js';
import { getNichePackOrThrow } from './packs.js';
import { validatePlan } from './validate.js';
import { generateTemplatePlan } from './template.js';
import { getOpenAIClientOrThrow } from '../providers/openaiClient.js';
import { generateFullScriptOpenAI, generateHooksOpenAI, generateOutlineAndScenesOpenAI } from './openaiGenerate.js';

export async function generatePlan(settings: ProjectSettings): Promise<{ payload: PlanVersionPayload; packTitle: string; templateMode: boolean }> {
  const pack = await getNichePackOrThrow(settings.nichePackId);

  // If OpenAI isn't configured, generate a deterministic template plan.
  if (!process.env.OPENAI_API_KEY) {
    const payload = generateTemplatePlan(settings, pack);
    return { payload, packTitle: pack.title, templateMode: true };
  }

  const client = getOpenAIClientOrThrow();

  const hookOptions = await generateHooksOpenAI(client, settings, pack);
  const hookSelected = hookOptions[0];

  const { outline, scenes: sceneDrafts } = await generateOutlineAndScenesOpenAI(client, settings, hookSelected, pack);

  const scenes: Scene[] = sceneDrafts.map((s, idx) => ({
    id: crypto.randomUUID(),
    idx,
    narrationText: s.narrationText,
    onScreenText: s.onScreenText,
    visualPrompt: s.visualPrompt,
    negativePrompt: s.negativePrompt ?? '',
    effectPreset: s.effectPreset as any,
    durationTargetSec: s.durationTargetSec,
    lock: false
  }));

  const scriptGen = await generateFullScriptOpenAI(client, settings, hookSelected, outline, scenes);
  for (const refined of scriptGen.scenes) {
    const target = scenes.find((s) => s.idx === refined.idx);
    if (target) {
      target.narrationText = refined.narrationText;
      target.onScreenText = refined.onScreenText;
    }
  }

  const wpm = settings.tempo === 'slow' ? 140 : settings.tempo === 'fast' ? 190 : 165;
  const words = scenes.map((s) => s.narrationText).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const estimatedLengthSec = Math.round((words / wpm) * 60);

  const basePayload: Omit<PlanVersionPayload, 'validation'> = {
    hookOptions,
    hookSelected,
    outline,
    scriptFull: scriptGen.scriptFull,
    scenes,
    estimates: { wpm, estimatedLengthSec, targetLengthSec: settings.targetLengthSec }
  };

  const v = validatePlan(settings, pack.config, basePayload);

  const payload: PlanVersionPayload = {
    ...basePayload,
    validation: { errors: v.errors, warnings: v.warnings, suggestions: v.suggestions }
  };

  return { payload, packTitle: pack.title, templateMode: false };
}

