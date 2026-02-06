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
import { logError } from '../utils/logger.js';

export const automateRoutes = Router();

const automateSchema = z
  .object({
    topic: z.string().min(1).max(500),
    nichePackId: z.string().min(1),
    language: z.string().min(1).max(10).optional(),
    targetLengthSec: z.number().int().positive().max(600).optional(),
    tempo: z.enum(['slow', 'normal', 'fast']).optional(),
    voicePreset: z.string().min(1).max(50).optional(),
    visualStylePreset: z.string().nullable().optional(),
    scriptTemplateId: z.string().min(1).max(50).optional(),
    seoKeywords: z.string().max(500).optional(),
  })
  .strict();

/**
 * POST /api/automate
 * One-click: create project → generate plan → validate → approve → start render.
 * Body: topic, nichePackId, language?, targetLengthSec?, tempo?, voicePreset?
 * Returns: { projectId, planVersionId, runId }
 */
automateRoutes.post('/', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Automate disabled in APP_TEST_MODE',
        code: 'AUTOMATE_DISABLED_TEST_MODE',
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

    const parsed = automateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parsed.error.flatten(),
      });
    }

    const {
      topic,
      nichePackId,
      language = 'en',
      targetLengthSec = 60,
      tempo = 'normal',
      voicePreset = 'alloy',
      visualStylePreset = null,
      scriptTemplateId,
      seoKeywords,
    } = parsed.data;

    const pack = getNichePack(nichePackId);
    if (!pack) {
      return res.status(400).json({ error: 'Invalid niche pack' });
    }

    // 1. Create project
    const project = await prisma.project.create({
      data: {
        id: uuid(),
        title: topic.substring(0, 100),
        topic,
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

    // 2. Generate plan (optionally with script template)
    const planVersion = await generatePlan(project, {
      scriptTemplateId: scriptTemplateId ?? undefined,
    });

    // 3. Update project with latest plan
    await prisma.project.update({
      where: { id: project.id },
      data: {
        latestPlanVersionId: planVersion.id,
        status: 'PLAN_READY',
      },
    });

    // P1-6 FIX: Add retry logic for plan lookup
    let fullPlan = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      fullPlan = await prisma.planVersion.findUnique({
        where: { id: planVersion.id },
        include: {
          scenes: { orderBy: { idx: 'asc' } },
          project: true,
        },
      });
      if (fullPlan) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!fullPlan) {
      logError('Plan not found after 3 attempts in automate endpoint', {
        planVersionId: planVersion.id,
        projectId: project.id,
      });
      return res.status(500).json({
        error: 'Plan version not found after generation',
        projectId: project.id,
        planVersionId: planVersion.id,
        message: 'Project and plan were created but lookup failed. Check database connectivity.',
      });
    }

    // 5. Validate plan
    const validation = validatePlan(fullPlan, fullPlan.project);
    if (validation.errors.length > 0) {
      return res.status(400).json({
        error: 'Plan has validation errors',
        validation,
      });
    }

    // 6. Approve (update project status)
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'APPROVED' },
    });

    // 7. Start render pipeline
    const run = await startRenderPipeline(fullPlan);

    res.json({
      projectId: project.id,
      planVersionId: fullPlan.id,
      runId: run.id,
    });
  } catch (error) {
    logError('Error in automate', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Automate failed',
    });
  }
});
