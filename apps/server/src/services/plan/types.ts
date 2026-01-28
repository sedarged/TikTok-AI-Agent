import { EffectPreset } from "./nichePacks.js";

export type ProjectSettings = {
  topic: string;
  nichePackId: string;
  language: string;
  targetLengthSec: number;
  tempo: "slow" | "normal" | "fast";
  voicePreset: string;
  visualStylePreset: string | null;
};

export type ScenePayload = {
  id: string;
  idx: number;
  narrationText: string;
  onScreenText: string;
  visualPrompt: string;
  negativePrompt: string;
  effectPreset: EffectPreset;
  durationTargetSec: number;
  lock: boolean;
};

export type PlanVersionPayload = {
  hookOptions: string[];
  hookSelected: string;
  outline: string;
  scriptFull: string;
  scenes: ScenePayload[];
  estimates: {
    wpm: number;
    estimatedLengthSec: number;
    targetLengthSec: number;
  };
  validation: {
    errors: string[];
    warnings: string[];
    suggestions: string[];
  };
};
