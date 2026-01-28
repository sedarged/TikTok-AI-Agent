export type Tempo = 'slow' | 'normal' | 'fast';

export type EffectPreset =
  | 'slow_zoom_in'
  | 'slow_zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'flash_cut'
  | 'fade'
  | 'glitch';

export type ProjectSettings = {
  topic: string;
  nichePackId: string;
  language: string;
  targetLengthSec: number;
  tempo: Tempo;
  voicePreset: string;
  visualStylePreset: string | null;
};

export type Scene = {
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
  hookOptions: [string, string, string, string, string];
  hookSelected: string;
  outline: string;
  scriptFull: string;
  scenes: Scene[];
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

