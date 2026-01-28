import { PlanVersion, Scene } from "@prisma/client";
import { PlanVersionPayload, ScenePayload } from "./types.js";

export function dbToScenePayload(scene: Scene): ScenePayload {
  return {
    id: scene.id,
    idx: scene.idx,
    narrationText: scene.narrationText,
    onScreenText: scene.onScreenText,
    visualPrompt: scene.visualPrompt,
    negativePrompt: scene.negativePrompt,
    effectPreset: scene.effectPreset as any,
    durationTargetSec: Number(scene.durationTargetSec),
    lock: scene.isLocked
  };
}

export function planVersionToPayload(
  plan: PlanVersion,
  scenes: Scene[]
): PlanVersionPayload {
  return {
    hookOptions: (plan.hookOptionsJson as string[]) ?? [],
    hookSelected: plan.hookSelected,
    outline: plan.outline,
    scriptFull: plan.scriptFull,
    scenes: scenes.map(dbToScenePayload),
    estimates: (plan.estimatesJson as PlanVersionPayload["estimates"]) ?? {
      wpm: 155,
      estimatedLengthSec: 0,
      targetLengthSec: 0
    },
    validation: (plan.validationJson as PlanVersionPayload["validation"]) ?? {
      errors: [],
      warnings: [],
      suggestions: []
    }
  };
}
