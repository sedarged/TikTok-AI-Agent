import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { generatePlan } from '../services/plan/planGenerator.js';
import { validatePlan } from '../services/plan/planValidator.js';
import { getNichePack } from '../services/nichePacks.js';
import { startRenderPipeline } from '../services/render/renderPipeline.js';
import { isOpenAIConfigured, isRenderDryRun, isTestMode } from '../env.js';
import { checkFFmpegAvailable } from '../services/ffmpeg/ffmpegUtils.js';
import { v4 as uuid } from 'uuid';

export const batchRoutes = Router();

const batchSchema = z
  .object({
    topics: z.array(z.string().min(1).max(500)).min(1).max(50),
    nichePackId: z.string().min(1),
    language: z.string().min(1).max(10).optional(),
    targetLengthSec: z.number().int().positive().max(600).optional(),
    tempo: z.enum(['slow', 'normal', 'fast']).optional(),
    voicePreset: z.string().min(1).max(50).optional(),
    visualStylePreset: z.string().nullable().optional(),
    seoKeywords: z.string().max(500).optional(),
    scriptTemplateId: z.string().min(1).max(50).optional(),
  })
  .strict();

/**
 * POST /api/batch
 * Create N projects (one per topic), generate plan, validate, approve, add run to queue.
 * Max 1 render runs at a time; others wait in queue.
 * Body: { topics: string[], nichePackId, language?, targetLengthSec?, tempo?, voicePreset? }
 * Returns: { runIds: string[] }
 *
 * Validation strategy: fail-fast. If plan validation fails for a topic, we return 400
 * immediately; runs for earlier topics in the batch may already be in the queue.
 */
batchRoutes.post('/', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Batch disabled in APP_TEST_MODE',
        code: 'BATCH_DISABLED_TEST_MODE',
      });
    }

    const renderDryRun = isRenderDryRun();
    if (!renderDryRun && !isOpenAIConfigured()) {
      return res.status(400).json({
        error: 'OpenAI API key not configured',
        code: 'OPENAI_NOT_CONFIGURED',
      });
    }

    const ffmpegAvailable = renderDryRun ? true : await checkFFmpegAvailable();
    if (!renderDryRun && !ffmpegAvailable) {
      return res.status(400).json({
        error: 'FFmpeg not available',
        code: 'FFMPEG_NOT_AVAILABLE',
      });
    }

    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parsed.error.flatten(),
      });
    }

    const {
      topics,
      nichePackId,
      language = 'en',
      targetLengthSec = 60,
      tempo = 'normal',
      voicePreset = 'alloy',
      visualStylePreset = null,
      seoKeywords,
      scriptTemplateId,
    } = parsed.data;

    const pack = getNichePack(nichePackId);
    if (!pack) {
      return res.status(400).json({ error: 'Invalid niche pack' });
    }

    const runIds: string[] = [];

    for (const topic of topics) {
      const trimmed = topic.trim();
      if (!trimmed) continue;

      const project = await prisma.project.create({
        data: {
          id: uuid(),
          title: trimmed.substring(0, 100),
          topic: trimmed,
          nichePackId,
          language,
          targetLengthSec,
          tempo,
          voicePreset,
          visualStylePreset,
          seoKeywords: seoKeywords ?? null,
          status: 'DRAFT_PLAN',
        },
      });

      const planVersion = await generatePlan(project, {
        scriptTemplateId: scriptTemplateId ?? undefined,
      });
      await prisma.project.update({
        where: { id: project.id },
        data: { latestPlanVersionId: planVersion.id, status: 'PLAN_READY' },
      });

      const fullPlan = await prisma.planVersion.findUnique({
        where: { id: planVersion.id },
        include: {
          scenes: { orderBy: { idx: 'asc' } },
          project: true,
        },
      });

      if (!fullPlan) {
        continue;
      }

      const validation = validatePlan(fullPlan, fullPlan.project);
      if (validation.errors.length > 0) {
        await prisma.project.update({
          where: { id: project.id },
          data: { status: 'FAILED' },
        });
        // Fail-fast: earlier topics may already have runs in the queue
        return res.status(400).json({
          error: `Plan validation failed for topic "${trimmed.substring(0, 50)}..."`,
          validation,
        });
      }

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'APPROVED' },
      });

      const run = await startRenderPipeline(fullPlan);
      runIds.push(run.id);
    }

    res.json({ runIds });
  } catch (error) {
    console.error('Error in batch:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Batch failed',
    });
  }
});
