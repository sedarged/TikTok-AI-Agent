import { pacingBucket, type NichePackConfig } from './packs.js';
import type { PlanVersionPayload, ProjectSettings } from './types.js';

export function validatePlan(settings: ProjectSettings, packConfig: NichePackConfig, payload: Omit<PlanVersionPayload, 'validation'>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!settings.topic?.trim()) errors.push('Project topic is required.');
  if (!settings.nichePackId?.trim()) errors.push('Niche pack is required.');
  if (!settings.language?.trim()) errors.push('Language is required.');
  if (!settings.voicePreset?.trim()) errors.push('Voice preset is required.');
  if (!settings.tempo) errors.push('Tempo is required.');
  if (!Number.isFinite(settings.targetLengthSec) || settings.targetLengthSec <= 0) errors.push('Target length must be a positive number.');

  if (!payload.hookSelected?.trim()) errors.push('Hook (selected) is required.');
  if (!payload.outline?.trim()) errors.push('Outline is required.');
  if (!payload.scriptFull?.trim()) errors.push('Full script is required.');
  if (!Array.isArray(payload.hookOptions) || payload.hookOptions.length !== 5) errors.push('hookOptions must be exactly 5 items.');

  if (!Array.isArray(payload.scenes) || payload.scenes.length === 0) {
    errors.push('Scenes are required.');
  }

  const bucket = pacingBucket(settings.targetLengthSec);
  const pacing = packConfig.scenePacing[bucket];
  const sceneCount = payload.scenes.length;
  if (sceneCount < pacing.minScenes || sceneCount > pacing.maxScenes) {
    errors.push(
      `Scene count ${sceneCount} is out of range for ${bucket}s pacing (${pacing.minScenes}-${pacing.maxScenes}).`
    );
  }

  let total = 0;
  for (const s of payload.scenes) {
    if (!s.narrationText?.trim()) errors.push(`Scene ${s.idx + 1}: narrationText is required.`);
    if (!s.onScreenText?.trim()) errors.push(`Scene ${s.idx + 1}: onScreenText is required.`);
    if (!s.visualPrompt?.trim()) errors.push(`Scene ${s.idx + 1}: visualPrompt is required.`);
    if (typeof s.negativePrompt !== 'string') errors.push(`Scene ${s.idx + 1}: negativePrompt is required (can be empty string).`);
    if (!s.effectPreset?.trim()) errors.push(`Scene ${s.idx + 1}: effectPreset is required.`);
    if (!Number.isFinite(s.durationTargetSec) || s.durationTargetSec <= 0) errors.push(`Scene ${s.idx + 1}: durationTargetSec must be > 0.`);
    total += s.durationTargetSec || 0;
  }

  const tolerance = settings.targetLengthSec >= 180 ? 5 : 3;
  const delta = total - settings.targetLengthSec;
  if (Math.abs(delta) > tolerance) {
    errors.push(
      `Total scene duration ${total.toFixed(1)}s is outside tolerance (target ${settings.targetLengthSec}s ± ${tolerance}s).`
    );
    suggestions.push('Use Auto-fit durations to match target length.');
  } else if (Math.abs(delta) > tolerance * 0.6) {
    warnings.push(
      `Total scene duration ${total.toFixed(1)}s is close to tolerance edge (target ${settings.targetLengthSec}s ± ${tolerance}s).`
    );
  }

  if (payload.estimates.estimatedLengthSec < settings.targetLengthSec * 0.85) {
    warnings.push('Estimated narration length looks short vs target. Consider expanding narrationText or reducing scene count.');
  }
  if (payload.estimates.estimatedLengthSec > settings.targetLengthSec * 1.15) {
    warnings.push('Estimated narration length looks long vs target. Consider trimming narrationText or increasing tempo.');
  }

  return { errors, warnings, suggestions, totalDurationSec: total };
}

