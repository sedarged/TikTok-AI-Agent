import { Scene } from '@prisma/client';

export interface ProjectSettings {
  topic: string;
  nichePackId: string;
  language: string;
  targetLengthSec: number;
  tempo: 'slow' | 'normal' | 'fast';
  voicePreset: string;
  visualStylePreset: string | null;
}

export interface PlanVersionPayload {
  hookOptions: string[];
  hookSelected: string;
  outline: string;
  scriptFull: string;
  scenes: SceneItem[];
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
}

export interface SceneItem {
  id: string; // uuid
  idx: number;
  narrationText: string;
  onScreenText: string;
  visualPrompt: string;
  negativePrompt: string;
  effectPreset: string;
  durationTargetSec: number;
  lock: boolean;
}

export const EFFECT_PRESETS = [
  "slow_zoom_in",
  "slow_zoom_out",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "flash_cut",
  "fade",
  "glitch"
] as const;
