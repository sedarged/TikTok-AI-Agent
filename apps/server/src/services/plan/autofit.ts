import { pacingBucket, type NichePackConfig } from './packs.js';
import type { Scene } from './types.js';

export function autofitDurations(targetLengthSec: number, packConfig: NichePackConfig, scenes: Scene[]) {
  const bucket = pacingBucket(targetLengthSec);
  const pacing = packConfig.scenePacing[bucket];

  const clamped = scenes.map((s) => ({
    ...s,
    durationTargetSec: clamp(s.durationTargetSec, pacing.minDur, pacing.maxDur)
  }));

  const currentTotal = clamped.reduce((a, s) => a + s.durationTargetSec, 0);
  const delta = targetLengthSec - currentTotal;

  if (Math.abs(delta) < 0.001) {
    return withTimeline(clamped);
  }

  const weights = clamped.map((s) => Math.max(0.1, s.durationTargetSec));
  const sumW = weights.reduce((a, w) => a + w, 0);
  const adjusted = clamped.map((s, i) => ({
    ...s,
    durationTargetSec: clamp(s.durationTargetSec + (delta * weights[i]) / sumW, pacing.minDur, pacing.maxDur)
  }));

  // If clamping introduced drift, distribute remaining seconds iteratively.
  let total = adjusted.reduce((a, s) => a + s.durationTargetSec, 0);
  let remaining = targetLengthSec - total;
  let guard = 0;
  while (Math.abs(remaining) > 0.01 && guard < 500) {
    guard++;
    const step = Math.sign(remaining) * 0.05;
    for (let i = 0; i < adjusted.length && Math.abs(remaining) > 0.01; i++) {
      const next = clamp(adjusted[i].durationTargetSec + step, pacing.minDur, pacing.maxDur);
      const diff = next - adjusted[i].durationTargetSec;
      if (Math.abs(diff) > 0) {
        adjusted[i].durationTargetSec = next;
        remaining -= diff;
      }
    }
    total = adjusted.reduce((a, s) => a + s.durationTargetSec, 0);
    remaining = targetLengthSec - total;
  }

  return withTimeline(adjusted);
}

function withTimeline(scenes: Scene[]) {
  let t = 0;
  return scenes.map((s) => {
    const start = t;
    const end = t + s.durationTargetSec;
    t = end;
    return { ...s, startTimeSec: start, endTimeSec: end } as Scene & { startTimeSec: number; endTimeSec: number };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

