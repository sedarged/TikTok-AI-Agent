import { NichePack } from "./nichePacks.js";
import { PlanVersionPayload } from "./types.js";

function pacingForTarget(pack: NichePack, targetLengthSec: number) {
  const key =
    targetLengthSec >= 180 ? "180" : targetLengthSec >= 120 ? "120" : targetLengthSec >= 90 ? "90" : "60";
  return pack.scenePacing[key];
}

export function validatePlan(
  pack: NichePack,
  plan: PlanVersionPayload
): PlanVersionPayload["validation"] {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!plan.hookSelected?.trim()) errors.push("Hook selected is missing.");
  if (!plan.hookOptions?.length) errors.push("Hook options are missing.");
  if (!plan.outline?.trim()) errors.push("Outline is missing.");
  if (!plan.scriptFull?.trim()) errors.push("Full script is missing.");
  if (!plan.scenes?.length) errors.push("Scenes are missing.");

  plan.scenes.forEach((scene, idx) => {
    if (!scene.narrationText?.trim()) errors.push(`Scene ${idx + 1} narration is missing.`);
    if (!scene.onScreenText?.trim()) warnings.push(`Scene ${idx + 1} on-screen text is empty.`);
    if (!scene.visualPrompt?.trim()) errors.push(`Scene ${idx + 1} visual prompt is missing.`);
    if (!scene.effectPreset) warnings.push(`Scene ${idx + 1} effect preset is missing.`);
    if (!scene.durationTargetSec || scene.durationTargetSec <= 0) {
      errors.push(`Scene ${idx + 1} duration is invalid.`);
    }
  });

  const pacing = pacingForTarget(pack, plan.estimates.targetLengthSec);
  if (plan.scenes.length < pacing.minScenes || plan.scenes.length > pacing.maxScenes) {
    warnings.push(
      `Scene count ${plan.scenes.length} is outside pacing range (${pacing.minScenes}-${pacing.maxScenes}).`
    );
  }

  const totalDuration = plan.scenes.reduce((sum, scene) => sum + (scene.durationTargetSec || 0), 0);
  const tolerance = plan.estimates.targetLengthSec >= 180 ? 5 : 3;
  if (Math.abs(totalDuration - plan.estimates.targetLengthSec) > tolerance) {
    warnings.push(
      `Total duration ${totalDuration.toFixed(1)}s is outside target ±${tolerance}s.`
    );
  }

  if (plan.estimates.estimatedLengthSec > plan.estimates.targetLengthSec + 5) {
    suggestions.push("Script may be too long; consider shortening narration.");
  }

  if (plan.estimates.estimatedLengthSec < plan.estimates.targetLengthSec - 5) {
    suggestions.push("Script may be too short; consider adding detail.");
  }

  return { errors, warnings, suggestions };
}
