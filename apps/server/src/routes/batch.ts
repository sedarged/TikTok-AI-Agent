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
import type { Project, PlanVersion, Scene } from '@prisma/client';

// Plan lookup retry configuration
const PLAN_LOOKUP_MAX_ATTEMPTS = 3;
const PLAN_LOOKUP_RETRY_DELAY_MS = 500;

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

    // P0-1 FIX: Validate all topics are non-empty before processing
    const emptyTopics: number[] = [];
    topics.forEach((topic, index) => {
      if (!topic.trim()) {
        emptyTopics.push(index);
      }
    });

    if (emptyTopics.length > 0) {
      return res.status(400).json({
        error: 'Empty or whitespace-only topics not allowed',
        emptyTopicIndexes: emptyTopics,
        message: `Topics at indexes [${emptyTopics.join(', ')}] are empty or contain only whitespace`,
      });
    }

    // P0-2 FIX: Two-phase processing - generate and validate ALL plans before queueing ANY runs
    // Design decision: We create projects and plans immediately (Phase 1) before validation is complete,
    // then attempt rollback if validation fails. This approach is chosen because:
    // 1. generatePlan() requires a persisted Project record to function (foreign key constraint)
    // 2. Per-project DB writes are wrapped in transactions for consistency
    // 3. Rollback errors are logged and tracked in the response for visibility
    // 4. The two-phase approach prevents partial batch execution (all-or-nothing semantics)
    // Phase 1: Generate and validate all plans
    interface BatchPlanResult {
      project: Project;
      planVersion: PlanVersion & { scenes: Scene[]; project: Project };
      topic: string;
    }
    const validatedPlans: BatchPlanResult[] = [];

    for (const topic of topics) {
      const trimmed = topic.trim();

      const { project, planVersion } = await prisma.$transaction(async (tx) => {
        const createdProject = await tx.project.create({
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

        const createdPlan = await generatePlan(createdProject, {
          scriptTemplateId: scriptTemplateId ?? undefined,
          db: tx,
        });

        await tx.project.update({
          where: { id: createdProject.id },
          data: { latestPlanVersionId: createdPlan.id, status: 'PLAN_READY' },
        });

        return { project: createdProject, planVersion: createdPlan };
      });

      // P0-4 FIX: Add retry logic for plan lookup with error instead of silent continue
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
        logError('Plan not found after 3 attempts in batch endpoint', {
          planVersionId: planVersion.id,
          topic: trimmed,
        });
        // Clean up projects created so far - track rollback failures
        const rollbackErrors: string[] = [];
        const rollbackIds = [
          ...validatedPlans.map((validated) => validated.project.id),
          project.id,
        ];
        if (rollbackIds.length > 0) {
          await prisma.project.deleteMany({ where: { id: { in: rollbackIds } } }).catch((err) => {
            logError('Batch rollback: failed to delete projects', {
              projectIds: rollbackIds,
              error: err,
            });
            rollbackErrors.push(...rollbackIds);
          });
        }

        const message =
          rollbackErrors.length > 0
            ? `Plan lookup failed. Rollback partially failed. Projects may still exist: ${rollbackErrors.join(', ')}`
            : 'Plan lookup failed. All batch projects rolled back.';

        return res.status(500).json({
          error: `Plan lookup failed for topic: ${trimmed}`,
          projectId: project.id,
          planVersionId: planVersion.id,
          message,
          rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined,
        });
      }

      const validation = validatePlan(fullPlan, fullPlan.project);
      if (validation.errors.length > 0) {
        // Clean up all projects created in this batch - track rollback failures
        const rollbackErrors: string[] = [];
        const rollbackIds = [
          ...validatedPlans.map((validated) => validated.project.id),
          project.id,
        ];
        if (rollbackIds.length > 0) {
          await prisma.project.deleteMany({ where: { id: { in: rollbackIds } } }).catch((err) => {
            logError('Batch rollback: failed to delete projects during validation failure', {
              projectIds: rollbackIds,
              error: err,
            });
            rollbackErrors.push(...rollbackIds);
          });
        }

        const message =
          rollbackErrors.length > 0
            ? `Validation failed. Rollback partially failed. Projects may still exist: ${rollbackErrors.join(', ')}`
            : 'Validation failed. No runs were queued. All batch projects rolled back.';

        return res.status(400).json({
          error: `Plan validation failed for topic "${trimmed.substring(0, 50)}..."`,
          validation,
          message,
          rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined,
        });
      }

      validatedPlans.push({ project, planVersion: fullPlan, topic: trimmed });
    }

    // Phase 2: All plans valid, now queue all runs
    const runIds: string[] = [];
    for (const { project, planVersion } of validatedPlans) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'APPROVED' },
      });

      const run = await startRenderPipeline(planVersion);
      runIds.push(run.id);
    }

    res.json({ runIds });
  } catch (error) {
    logError('Error in batch', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Batch failed',
    });
  }
});
