import { v4 as uuid } from "uuid";
import { NichePack, EffectPreset } from "./nichePacks.js";
import { ProjectSettings, PlanVersionPayload, ScenePayload } from "./types.js";
import { countWords } from "../../utils/text.js";

const hookTemplates = [
  (topic: string) => `Most people miss this about ${topic}.`,
  (topic: string) => `Here is the surprising truth about ${topic}.`,
  (topic: string) => `If you only knew one thing about ${topic}, make it this.`,
  (topic: string) => `${topic} looks simple, but there's a smarter way.`,
  (topic: string) => `The ${topic} tip that actually works.`
];

function pickSceneCount(pack: NichePack, targetLengthSec: number): number {
  const key = targetLengthSec >= 180 ? "180" : targetLengthSec >= 120 ? "120" : targetLengthSec >= 90 ? "90" : "60";
  const pacing = pack.scenePacing[key];
  return Math.round((pacing.minScenes + pacing.maxScenes) / 2);
}

function distributeDurations(count: number, targetLengthSec: number): number[] {
  const base = targetLengthSec / count;
  return Array.from({ length: count }, () => Math.max(4, Number(base.toFixed(2))));
}

export function generateTemplatePlan(
  settings: ProjectSettings,
  pack: NichePack
): PlanVersionPayload {
  const sceneCount = pickSceneCount(pack, settings.targetLengthSec);
  const durations = distributeDurations(sceneCount, settings.targetLengthSec);
  const hookOptions = hookTemplates.map((fn) => fn(settings.topic)).slice(0, 5);
  const hookSelected = hookOptions[0];
  const outline = [
    `Hook: ${hookSelected}`,
    `Key point 1 about ${settings.topic}`,
    `Key point 2 about ${settings.topic}`,
    `Key point 3 about ${settings.topic}`,
    `Quick recap and closing`
  ].join("\n");

  const scenes: ScenePayload[] = durations.map((duration, idx) => {
    const sceneIdx = idx + 1;
    const effectPreset: EffectPreset =
      pack.effectsProfile.allowedEffects[sceneIdx % pack.effectsProfile.allowedEffects.length] ??
      pack.effectsProfile.defaultEffect;
    return {
      id: uuid(),
      idx,
      narrationText: `Scene ${sceneIdx}: A concise insight about ${settings.topic} with a clear takeaway.`,
      onScreenText: `Scene ${sceneIdx}: ${settings.topic}`,
      visualPrompt: `A clean vertical visual representing ${settings.topic}, scene ${sceneIdx}, cinematic composition${settings.visualStylePreset ? `, ${settings.visualStylePreset}` : ""}.`,
      negativePrompt: pack.globalNegativePrompt,
      effectPreset,
      durationTargetSec: duration,
      lock: false
    };
  });

  const scriptFull = scenes
    .map((scene) => scene.narrationText)
    .join(" ");
  const wpm = settings.tempo === "fast" ? 180 : settings.tempo === "slow" ? 130 : 155;
  const estimatedLengthSec = Math.max(10, Math.round((countWords(scriptFull) / wpm) * 60));

  return {
    hookOptions,
    hookSelected,
    outline,
    scriptFull,
    scenes,
    estimates: {
      wpm,
      estimatedLengthSec,
      targetLengthSec: settings.targetLengthSec
    },
    validation: {
      errors: [],
      warnings: [],
      suggestions: [
        "Template mode used because no OpenAI API key was configured.",
        "Consider regenerating with AI for richer narration."
      ]
    }
  };
}
