import { Router } from 'express';
import { z } from 'zod';
import { isRenderDryRun, isTestMode } from '../env.js';

export const testRoutes = Router();

const allowedSteps = [
  'tts_generate',
  'asr_align',
  'images_generate',
  'captions_build',
  'music_build',
  'ffmpeg_render',
  'finalize_artifacts',
] as const;

const dryRunConfigSchema = z.object({
  failStep: z.enum(allowedSteps).or(z.literal('')).optional().nullable(),
  stepDelayMs: z.number().int().min(0).max(5000).optional().nullable(),
}).strict();

function isEnabled(): boolean {
  return isRenderDryRun() || isTestMode();
}

function getCurrentConfig() {
  const failStep = process.env.APP_DRY_RUN_FAIL_STEP || '';
  const rawDelay = process.env.APP_DRY_RUN_STEP_DELAY_MS || '0';
  const delay = Number.isFinite(parseInt(rawDelay, 10)) ? parseInt(rawDelay, 10) : 0;
  return {
    failStep,
    stepDelayMs: Math.max(0, delay),
  };
}

testRoutes.get('/dry-run-config', (req, res) => {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(getCurrentConfig());
});

testRoutes.post('/dry-run-config', (req, res) => {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const parsed = dryRunConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid dry-run config payload',
      details: parsed.error.flatten(),
    });
  }

  if (parsed.data.failStep !== undefined && parsed.data.failStep !== null) {
    process.env.APP_DRY_RUN_FAIL_STEP = parsed.data.failStep;
  }

  if (parsed.data.stepDelayMs !== undefined && parsed.data.stepDelayMs !== null) {
    process.env.APP_DRY_RUN_STEP_DELAY_MS = String(parsed.data.stepDelayMs);
  }

  return res.json(getCurrentConfig());
});
