// Effect presets
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

export type EffectPreset = typeof EFFECT_PRESETS[number];

// Project status
export type ProjectStatus = 
  | 'DRAFT_PLAN' 
  | 'PLAN_READY' 
  | 'APPROVED' 
  | 'RENDERING' 
  | 'DONE' 
  | 'FAILED';

// Run status
export type RunStatus = 
  | 'queued' 
  | 'running' 
  | 'done' 
  | 'failed' 
  | 'canceled';

// Tempo
export type Tempo = 'slow' | 'normal' | 'fast';

// Voice presets
export const VOICE_PRESETS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
export type VoicePreset = typeof VOICE_PRESETS[number];

// Project
export interface Project {
  id: string;
  title: string;
  topic: string;
  nichePackId: string;
  language: string;
  targetLengthSec: number;
  tempo: Tempo;
  voicePreset: string;
  visualStylePreset: string | null;
  status: ProjectStatus;
  latestPlanVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  planVersions?: PlanVersion[];
  runs?: Run[];
}

// Scene
export interface Scene {
  id: string;
  projectId: string;
  planVersionId: string;
  idx: number;
  narrationText: string;
  onScreenText: string;
  visualPrompt: string;
  negativePrompt: string;
  effectPreset: EffectPreset;
  durationTargetSec: number;
  startTimeSec: number;
  endTimeSec: number;
  isLocked: boolean;
  updatedAt: string;
}

// Plan version
export interface PlanVersion {
  id: string;
  projectId: string;
  createdAt: string;
  hookOptionsJson: string;
  hookSelected: string;
  outline: string;
  scriptFull: string;
  estimatesJson: string;
  validationJson: string;
  scenes?: Scene[];
  project?: Project;
}

// Parsed plan data
export interface PlanData {
  hookOptions: string[];
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
}

// Run
export interface Run {
  id: string;
  projectId: string;
  planVersionId: string;
  status: RunStatus;
  progress: number;
  currentStep: string;
  logsJson: string;
  artifactsJson: string;
  resumeStateJson: string;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  planVersion?: PlanVersion;
}

// Log entry
export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

// Artifacts
export interface Artifacts {
  imagesDir?: string;
  audioDir?: string;
  captionsPath?: string;
  mp4Path?: string;
  thumbPath?: string;
  exportJsonPath?: string;
}

// Niche pack
export interface NichePack {
  id: string;
  name: string;
  description: string;
}

// Validation result
export interface ValidationResult {
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Verification result
export interface VerificationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: Record<string, unknown>;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// Provider status
export interface ProviderStatus {
  providers: {
    openai: boolean;
    elevenlabs: boolean;
    ffmpeg: boolean;
  };
  ready: boolean;
  message: string;
}

// SSE event
export interface SSEEvent {
  type: 'state' | 'progress' | 'step' | 'log' | 'done' | 'failed' | 'canceled';
  status?: RunStatus;
  progress?: number;
  currentStep?: string;
  step?: string;
  message?: string;
  logs?: LogEntry[];
  log?: LogEntry;
  error?: string;
}
