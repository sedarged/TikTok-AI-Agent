import { z } from 'zod';

export const SceneSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  planVersionId: z.string(),
  idx: z.number(),
  narrationText: z.string(),
  onScreenText: z.string(),
  visualPrompt: z.string(),
  negativePrompt: z.string(),
  effectPreset: z.string(),
  durationTargetSec: z.number(),
  startTimeSec: z.number(),
  endTimeSec: z.number(),
  isLocked: z.boolean(),
  updatedAt: z.string(),
});

export const PlanVersionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
  hookOptionsJson: z.string(),
  hookSelected: z.string(),
  outline: z.string(),
  scriptFull: z.string(),
  estimatesJson: z.string(),
  validationJson: z.string(),
  scenes: z.array(SceneSchema).optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  nichePackId: z.string(),
  language: z.string(),
  targetLengthSec: z.number(),
  tempo: z.string(),
  voicePreset: z.string(),
  visualStylePreset: z.string().nullable(),
  status: z.string(),
  latestPlanVersionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  planVersionId: z.string(),
  status: z.string(),
  progress: z.number(),
  currentStep: z.string(),
  logsJson: z.string(),
  artifactsJson: z.string(),
  resumeStateJson: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProjectWithRelationsSchema = ProjectSchema.extend({
  planVersions: z.array(PlanVersionSchema).optional(),
  runs: z.array(RunSchema).optional(),
});

export const RunWithRelationsSchema = RunSchema.extend({
  project: ProjectSchema.optional(),
  planVersion: PlanVersionSchema.optional(),
});
