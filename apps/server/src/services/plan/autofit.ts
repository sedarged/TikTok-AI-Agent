import { NichePack } from "./nichePacks.js";
import { PlanVersionPayload } from "./types.js";
import { clamp } from "../../utils/text.js";

function pacingForTarget(pack: NichePack, targetLengthSec: number) {
  const key =
    targetLengthSec >= 180 ? "180" : targetLengthSec >= 120 ? "120" : targetLengthSec >= 90 ? "90" : "60";
  return pack.scenePacing[key];
}

export function autoFitDurations(
  plan: PlanVersionPayload,
  pack: NichePack
): PlanVersionPayload {
  const pacing = pacingForTarget(pack, plan.estimates.targetLengthSec);
  const target = plan.estimates.targetLengthSec;
  const durations = plan.scenes.map((scene) =>
    clamp(scene.durationTargetSec || pacing.minDur, pacing.minDur, pacing.maxDur)
  );

  const total = durations.reduce((sum, value) => sum + value, 0);
  let remainder = target - total;

  if (Math.abs(remainder) > 0.01) {
    const weightSum = durations.reduce((sum, value) => sum + value, 0) || 1;
    const adjusted = durations.map((value) => {
      const delta = (value / weightSum) * remainder;
      return clamp(value + delta, pacing.minDur, pacing.maxDur);
    });
    const adjustedTotal = adjusted.reduce((sum, value) => sum + value, 0);
    remainder = target - adjustedTotal;
    if (Math.abs(remainder) > 0.01) {
      const perScene = remainder / adjusted.length;
      for (let i = 0; i < adjusted.length; i += 1) {
        adjusted[i] = clamp(adjusted[i] + perScene, pacing.minDur, pacing.maxDur);
      }
    }
    plan.scenes = plan.scenes.map((scene, idx) => ({
      ...scene,
      durationTargetSec: Number(adjusted[idx].toFixed(2))
    }));
  } else {
    plan.scenes = plan.scenes.map((scene, idx) => ({
      ...scene,
      durationTargetSec: Number(durations[idx].toFixed(2))
    }));
  }

  return plan;
}

export function computeSceneTimings(
  durations: number[]
): { start: number; end: number }[] {
  let current = 0;
  return durations.map((duration) => {
    const start = Number(current.toFixed(2));
    const end = Number((current + duration).toFixed(2));
    current += duration;
    return { start, end };
  });
}
