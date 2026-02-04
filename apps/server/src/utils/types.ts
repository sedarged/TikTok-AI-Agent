// Effect presets for scene animations
export const EFFECT_PRESETS = [
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
  'flash_cut',
  'fade',
  'glitch',
  'static',
] as const;

export type EffectPreset = (typeof EFFECT_PRESETS)[number];

// Project status
export type ProjectStatus =
  | 'DRAFT_PLAN'
  | 'PLAN_READY'
  | 'APPROVED'
  | 'RENDERING'
  | 'DONE'
  | 'FAILED';

// Run status
export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled';

// Tempo
export type Tempo = 'slow' | 'normal' | 'fast';

// Project settings
export interface ProjectSettings {
  topic: string;
  nichePackId: string;
  language: string;
  targetLengthSec: number;
  tempo: Tempo;
  voicePreset: string;
  visualStylePreset: string | null;
}

// Scene structure
export interface SceneData {
  id: string;
  idx: number;
  narrationText: string;
  onScreenText: string;
  visualPrompt: string;
  negativePrompt: string;
  effectPreset: EffectPreset;
  durationTargetSec: number;
  startTimeSec?: number;
  endTimeSec?: number;
  isLocked: boolean;
}

// Estimates
export interface Estimates {
  wpm: number;
  estimatedLengthSec: number;
  targetLengthSec: number;
}

// Validation result
export interface ValidationResult {
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Plan version payload
export interface PlanVersionPayload {
  hookOptions: string[];
  hookSelected: string;
  outline: string;
  scriptFull: string;
  scenes: SceneData[];
  estimates: Estimates;
  validation: ValidationResult;
}

// Artifacts structure
export interface Artifacts {
  imagesDir?: string;
  audioDir?: string;
  captionsPath?: string;
  mp4Path?: string;
  thumbPath?: string;
  /** 3 thumbnails for cover choice: 0s, 3s, mid */
  thumbPaths?: string[];
  exportJsonPath?: string;
  dryRun?: boolean;
  dryRunReportPath?: string;
  /** QA check result when status is qa_failed */
  qaResult?: { silence?: boolean; fileSize?: boolean; resolution?: boolean; details?: string };
  /** TikTok metadata (caption, hashtags, title) */
  tiktokCaption?: string;
  tiktokHashtags?: string[];
  tiktokTitle?: string;
  /** Estimated cost (USD) for this run */
  costEstimate?: { estimatedUsd: number };
}

// Resume state
export interface ResumeState {
  lastCompletedStep?: string;
  completedSceneIdxs?: number[];
}

// Log entry
export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}
