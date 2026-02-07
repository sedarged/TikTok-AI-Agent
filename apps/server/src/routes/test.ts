import { Router } from 'express';
import { z } from 'zod';
import {
  isRenderDryRun,
  isTestMode,
  getDryRunConfig,
  setDryRunConfig,
  isProduction,
} from '../env.js';
import { requireAuth } from '../middleware/auth.js';

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

const dryRunConfigSchema = z
  .object({
    failStep: z.enum(allowedSteps).or(z.literal('')).optional().nullable(),
    stepDelayMs: z.number().int().min(0).max(5000).optional().nullable(),
  })
  .strict();

function isEnabled(): boolean {
  // Never enable test routes in production, even if dry-run flags are set
  if (isProduction()) {
    return false;
  }
  return isRenderDryRun() || isTestMode();
}

testRoutes.get('/dry-run-config', (req, res) => {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  return requireAuth(req, res, () => {
    res.json(getDryRunConfig());
  });
});

testRoutes.post('/dry-run-config', (req, res) => {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  return requireAuth(req, res, () => {
    const parsed = dryRunConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid dry-run config payload',
        details: parsed.error.flatten(),
      });
    }

    const updateData: { failStep?: string; stepDelayMs?: number } = {};
    if (parsed.data.failStep !== undefined && parsed.data.failStep !== null) {
      updateData.failStep = parsed.data.failStep;
    }
    if (parsed.data.stepDelayMs !== undefined && parsed.data.stepDelayMs !== null) {
      updateData.stepDelayMs = parsed.data.stepDelayMs;
    }

    setDryRunConfig(updateData);

    return res.json(getDryRunConfig());
  });
});
