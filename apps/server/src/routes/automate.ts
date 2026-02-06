import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { generatePlanData, savePlanData } from '../services/plan/planGenerator.js';
import { validatePlan } from '../services/plan/planValidator.js';
import { getNichePack } from '../services/nichePacks.js';
import { startRenderPipeline } from '../services/render/renderPipeline.js';
import { isOpenAIConfigured, isRenderDryRun, isTestMode } from '../env.js';
import { checkFFmpegAvailable } from '../services/ffmpeg/ffmpegUtils.js';
import { v4 as uuid } from 'uuid';
import { logError, logInfo } from '../utils/logger.js';

// Plan lookup retry configuration (shared with batch.ts)
const PLAN_LOOKUP_MAX_ATTEMPTS = 3;
const PLAN_LOOKUP_RETRY_DELAY_MS = 500;

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

    // Step 1: Create project
    const createdProject = await prisma.project.create({
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

    // Step 2: Generate plan content (performs OpenAI calls outside transaction)
    let planData;
    try {
      planData = await generatePlanData(createdProject, scriptTemplateId ?? undefined);
    } catch (planError) {
      // Clean up project on plan generation failure
      try {
        await prisma.project.delete({ where: { id: createdProject.id } });
        logInfo('Cleaned up project after plan generation failure', {
          projectId: createdProject.id,
          topic,
        });
      } catch (cleanupError) {
        logError('Failed to clean up project after plan generation failure', cleanupError, {
          projectId: createdProject.id,
          topic,
          originalError: planError,
        });
      }
      throw planError;
    }

    // Step 3: Save plan to DB in a transaction
    const planVersion = await prisma.$transaction(async (tx) => {
      const createdPlan = await savePlanData(createdProject, planData, tx);

      await tx.project.update({
        where: { id: createdProject.id },
        data: {
          latestPlanVersionId: createdPlan.id,
          status: 'PLAN_READY',
        },
      });

      return createdPlan;
    });

    // P1-6 FIX: Add retry logic for plan lookup
    let fullPlan = null;
    for (let attempt = 0; attempt < PLAN_LOOKUP_MAX_ATTEMPTS; attempt++) {
      fullPlan = await prisma.planVersion.findUnique({
        where: { id: planVersion.id },
        include: {
          scenes: { orderBy: { idx: 'asc' } },
          project: true,
        },
      });
      if (fullPlan) break;
      // Wait before retry, but not after the last attempt
      if (attempt < PLAN_LOOKUP_MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, PLAN_LOOKUP_RETRY_DELAY_MS));
      }
    }

    if (!fullPlan) {
      logError('Plan not found after 3 attempts in automate endpoint', {
        planVersionId: planVersion.id,
        projectId: createdProject.id,
      });
      return res.status(500).json({
        error: 'Plan version not found after generation',
        projectId: createdProject.id,
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
      where: { id: createdProject.id },
      data: { status: 'APPROVED' },
    });

    // 7. Start render pipeline
    const run = await startRenderPipeline(fullPlan);

    res.json({
      projectId: createdProject.id,
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
