import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { validatePlan, autofitDurations } from '../services/plan/planValidator.js';
import {
  regenerateHooks,
  regenerateOutline,
  regenerateScript,
} from '../services/plan/planGenerator.js';
import { startRenderPipeline } from '../services/render/renderPipeline.js';
import { isOpenAIConfigured, isRenderDryRun, isTestMode } from '../env.js';
import { checkFFmpegAvailable } from '../services/ffmpeg/ffmpegUtils.js';
import { logError, logOperationStart, logOperationError } from '../utils/logger.js';
import type { Scene } from '@prisma/client';

export const planRoutes = Router();

const sceneUpdateSchema = z
  .object({
    id: z.string().uuid(),
    narrationText: z.string().optional(),
    onScreenText: z.string().optional(),
    visualPrompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    effectPreset: z.string().optional(),
    durationTargetSec: z.number().positive().optional(),
    isLocked: z.boolean().optional(),
  })
  .strict();

const planUpdateSchema = z
  .object({
    hookSelected: z.string().optional(),
    outline: z.string().optional(),
    scriptFull: z.string().optional(),
    scenes: z.array(sceneUpdateSchema).optional(),
  })
  .strict();

const planVersionIdParamsSchema = z.object({ planVersionId: z.uuid() });

// Get plan version
planRoutes.get('/:planVersionId', async (req, res) => {
  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
        },
        project: true,
      },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    res.json(planVersion);
  } catch (error) {
    logError('Error getting plan version', error);
    res.status(500).json({ error: 'Failed to get plan version' });
  }
});

// Update plan version (autosave)
planRoutes.put('/:planVersionId', async (req, res) => {
  try {
    const parsedBody = planUpdateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'Invalid plan update payload',
        details: parsedBody.error.flatten(),
      });
    }
    const parsedParams = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsedParams.error.flatten(),
      });
    }
    const { hookSelected, outline, scriptFull, scenes } = parsedBody.data;
    const { planVersionId } = parsedParams.data;

    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: { project: true },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    // Validate and fetch scenes first if provided (before making any updates)
    let scenesToUpdate: Map<string, Scene> = new Map();
    if (scenes && Array.isArray(scenes)) {
      const sceneIds = scenes.filter((s) => s.id).map((s) => s.id);

      if (sceneIds.length > 0) {
        // Fetch all scenes in a single query
        const existingScenes = await prisma.scene.findMany({
          where: {
            id: { in: sceneIds },
          },
        });

        // Build a map for quick lookup
        const existingScenesMap = new Map(existingScenes.map((s) => [s.id, s]));

        // Validate ownership
        const rejectedSceneIds: string[] = [];
        for (const sceneId of sceneIds) {
          const existingScene = existingScenesMap.get(sceneId);
          if (!existingScene || existingScene.planVersionId !== planVersionId) {
            rejectedSceneIds.push(sceneId);
          }
        }

        // Return error if any scenes were rejected (before making any updates)
        if (rejectedSceneIds.length > 0) {
          return res.status(400).json({
            error: 'Some scene IDs do not belong to this plan',
            rejectedSceneIds,
          });
        }

        // Issue 8: Check for attempts to modify locked scenes
        const lockedSceneIds: string[] = [];
        for (const scene of scenes) {
          if (!scene.id) continue;
          const existingScene = existingScenesMap.get(scene.id);
          if (!existingScene) continue;

          // If scene is locked, check if any updatable fields are being modified
          if (existingScene.isLocked) {
            // Allow no-op updates (only id field) or explicit unlocking
            const hasUpdateFields =
              scene.narrationText !== undefined ||
              scene.onScreenText !== undefined ||
              scene.visualPrompt !== undefined ||
              scene.negativePrompt !== undefined ||
              scene.effectPreset !== undefined ||
              scene.durationTargetSec !== undefined;

            const isUnlocking = scene.isLocked === false;

            // Reject if trying to modify fields (other than unlocking)
            if (hasUpdateFields && !isUnlocking) {
              lockedSceneIds.push(scene.id);
            }
          }
        }

        // Return error if any locked scenes would be modified
        if (lockedSceneIds.length > 0) {
          return res.status(400).json({
            error: 'Cannot modify locked scenes. Unlock them first.',
            lockedSceneIds,
          });
        }

        // Store validated scenes for updates
        scenesToUpdate = existingScenesMap;
      }
    }

    // Update plan version fields
    const updateData: {
      hookSelected?: string;
      outline?: string;
      scriptFull?: string;
    } = {};
    if (hookSelected !== undefined) updateData.hookSelected = hookSelected;
    if (outline !== undefined) updateData.outline = outline;
    if (scriptFull !== undefined) updateData.scriptFull = scriptFull;

    // P0-3 FIX: Wrap plan version update and scene updates in a single transaction
    // to ensure atomicity (all-or-nothing)
    if (
      Object.keys(updateData).length > 0 ||
      (scenes && Array.isArray(scenes) && scenesToUpdate.size > 0)
    ) {
      await prisma.$transaction(async (tx) => {
        // Update plan version if there are changes
        if (Object.keys(updateData).length > 0) {
          await tx.planVersion.update({
            where: { id: planVersionId },
            data: updateData,
          });
        }

        // Update scenes if provided (now we know all scenes are valid and not locked)
        if (scenes && Array.isArray(scenes) && scenesToUpdate.size > 0) {
          for (const scene of scenes) {
            if (!scene.id) continue;

            const existingScene = scenesToUpdate.get(scene.id);
            if (!existingScene) continue; // Scene was filtered out in validation

            // Validation already rejected locked scene modifications, so we can safely update
            await tx.scene.update({
              where: { id: scene.id },
              data: {
                narrationText: scene.narrationText ?? existingScene.narrationText,
                onScreenText: scene.onScreenText ?? existingScene.onScreenText,
                visualPrompt: scene.visualPrompt ?? existingScene.visualPrompt,
                negativePrompt: scene.negativePrompt ?? existingScene.negativePrompt,
                effectPreset: scene.effectPreset ?? existingScene.effectPreset,
                durationTargetSec: scene.durationTargetSec ?? existingScene.durationTargetSec,
                isLocked: scene.isLocked ?? existingScene.isLocked,
              },
            });
          }
        }
      });
    }

    // Fetch updated plan
    const updatedPlan = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
        },
      },
    });

    res.json(updatedPlan);
  } catch (error) {
    logError('Error updating plan version', error);
    res.status(500).json({ error: 'Failed to update plan version' });
  }
});

// Validate plan
planRoutes.post('/:planVersionId/validate', async (req, res) => {
  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
        },
        project: true,
      },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    const validation = validatePlan(planVersion, planVersion.project);

    // Update validation in DB
    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: {
        validationJson: JSON.stringify(validation),
      },
    });

    res.json(validation);
  } catch (error) {
    logError('Error validating plan', error);
    res.status(500).json({ error: 'Failed to validate plan' });
  }
});

// Auto-fit durations
planRoutes.post('/:planVersionId/autofit', async (req, res) => {
  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
        },
        project: true,
      },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    // Issue 11: Validate scenes have non-empty narration
    const emptyScenes: number[] = [];
    for (const scene of planVersion.scenes) {
      if (!scene.narrationText || scene.narrationText.trim().length === 0) {
        emptyScenes.push(scene.idx);
      }
    }

    if (emptyScenes.length > 0) {
      return res.status(400).json({
        error: 'Cannot autofit durations: some scenes have empty narration',
        emptyScenes: emptyScenes.map((idx) => idx + 1), // Display as 1-indexed
      });
    }

    const fittedScenes = autofitDurations(planVersion.scenes, planVersion.project);

    // Recalculate estimates
    const totalDuration = fittedScenes.reduce((sum, s) => sum + s.durationTargetSec, 0);
    const totalWords = fittedScenes.reduce(
      (sum, s) => sum + s.narrationText.split(/\s+/).length,
      0
    );
    const wpm = totalDuration > 0 ? (totalWords / totalDuration) * 60 : 0;

    // P1-6 FIX: Update all scenes and plan estimates atomically using transaction array form.
    // This batches N scene updates + 1 plan update into a single transaction for atomicity.
    const updateOperations = [
      ...fittedScenes.map((scene) =>
        prisma.scene.update({
          where: { id: scene.id },
          data: {
            durationTargetSec: scene.durationTargetSec,
            startTimeSec: scene.startTimeSec,
            endTimeSec: scene.endTimeSec,
          },
        })
      ),
      prisma.planVersion.update({
        where: { id: planVersion.id },
        data: {
          estimatesJson: JSON.stringify({
            wpm: Math.round(wpm),
            estimatedLengthSec: Math.round(totalDuration),
            targetLengthSec: planVersion.project.targetLengthSec,
          }),
        },
      }),
    ];
    await prisma.$transaction(updateOperations);

    // Fetch updated plan
    const updatedPlan = await prisma.planVersion.findUnique({
      where: { id: planVersion.id },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
        },
      },
    });

    res.json(updatedPlan);
  } catch (error) {
    logError('Error auto-fitting durations', error);
    res.status(500).json({ error: 'Failed to auto-fit durations' });
  }
});

// Regenerate hooks
planRoutes.post('/:planVersionId/regenerate-hooks', async (req, res) => {
  const requestId = req.requestId;
  let startTime: number | undefined;

  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: { project: true },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    const logOperation = logOperationStart({
      requestId,
      operation: 'regenerate-hooks',
      planVersionId,
      projectId: planVersion.projectId,
    });
    startTime = logOperation.startTime;

    const hookOptions = await regenerateHooks(planVersion.project);

    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: {
        hookOptionsJson: JSON.stringify(hookOptions),
      },
    });

    logOperation.complete();

    res.json({ hookOptions });
  } catch (error) {
    if (startTime !== undefined) {
      logOperationError(
        {
          requestId,
          operation: 'regenerate-hooks',
          planVersionId: req.params.planVersionId,
        },
        error,
        startTime
      );
    } else {
      logError('Error regenerating hooks', error, { requestId });
    }
    res.status(500).json({ error: 'Failed to regenerate hooks' });
  }
});

// Regenerate outline
planRoutes.post('/:planVersionId/regenerate-outline', async (req, res) => {
  const requestId = req.requestId;
  let startTime: number | undefined;

  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: { project: true },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    const logOperation = logOperationStart({
      requestId,
      operation: 'regenerate-outline',
      planVersionId,
      projectId: planVersion.projectId,
    });
    startTime = logOperation.startTime;

    const outline = await regenerateOutline(planVersion.project, planVersion.hookSelected);

    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: { outline },
    });

    logOperation.complete();

    res.json({ outline });
  } catch (error) {
    if (startTime !== undefined) {
      logOperationError(
        {
          requestId,
          operation: 'regenerate-outline',
          planVersionId: req.params.planVersionId,
        },
        error,
        startTime
      );
    } else {
      logError('Error regenerating outline', error, { requestId });
    }
    res.status(500).json({ error: 'Failed to regenerate outline' });
  }
});

// Regenerate script
planRoutes.post('/:planVersionId/regenerate-script', async (req, res) => {
  const requestId = req.requestId;
  let startTime: number | undefined;

  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: { orderBy: { idx: 'asc' } },
        project: true,
      },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    const logOperation = logOperationStart({
      requestId,
      operation: 'regenerate-script',
      planVersionId,
      projectId: planVersion.projectId,
    });
    startTime = logOperation.startTime;

    const { scriptFull, scenes } = await regenerateScript(
      planVersion.project,
      planVersion.hookSelected,
      planVersion.outline,
      planVersion.scenes
    );

    // P1-6 FIX: Update plan version and all scenes atomically using transaction array form.
    // This batches 1 plan update + N scene updates into a single transaction for atomicity.
    const updateOperations = [
      prisma.planVersion.update({
        where: { id: planVersion.id },
        data: { scriptFull },
      }),
      ...scenes.map((scene) =>
        prisma.scene.update({
          where: { id: scene.id },
          data: { narrationText: scene.narrationText },
        })
      ),
    ];
    await prisma.$transaction(updateOperations);

    const updatedPlan = await prisma.planVersion.findUnique({
      where: { id: planVersion.id },
      include: { scenes: { orderBy: { idx: 'asc' } } },
    });

    logOperation.complete();

    res.json(updatedPlan);
  } catch (error) {
    if (startTime !== undefined) {
      logOperationError(
        {
          requestId,
          operation: 'regenerate-script',
          planVersionId: req.params.planVersionId,
        },
        error,
        startTime
      );
    } else {
      logError('Error regenerating script', error, { requestId });
    }
    res.status(500).json({ error: 'Failed to regenerate script' });
  }
});

// Approve plan
planRoutes.post('/:planVersionId/approve', async (req, res) => {
  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: { orderBy: { idx: 'asc' } },
        project: true,
      },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    // Validate before approval
    const validation = validatePlan(planVersion, planVersion.project);

    if (validation.errors.length > 0) {
      return res.status(400).json({
        error: 'Plan has validation errors',
        validation,
      });
    }

    // Update project status
    await prisma.project.update({
      where: { id: planVersion.projectId },
      data: { status: 'APPROVED' },
    });

    res.json({ success: true, message: 'Plan approved' });
  } catch (error) {
    logError('Error approving plan', error);
    res.status(500).json({ error: 'Failed to approve plan' });
  }
});

// Start render
planRoutes.post('/:planVersionId/render', async (req, res) => {
  try {
    const parsed = planVersionIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid plan version ID',
        details: parsed.error.flatten(),
      });
    }
    const { planVersionId } = parsed.data;
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Rendering disabled in APP_TEST_MODE',
        code: 'RENDER_DISABLED_TEST_MODE',
      });
    }

    const renderDryRun = isRenderDryRun();

    // Check providers
    if (!renderDryRun && !isOpenAIConfigured()) {
      return res.status(400).json({
        error: 'Cannot render: OpenAI API key not configured',
        code: 'OPENAI_NOT_CONFIGURED',
      });
    }

    const ffmpegAvailable = renderDryRun ? true : await checkFFmpegAvailable();
    if (!renderDryRun && !ffmpegAvailable) {
      return res.status(400).json({
        error: 'Cannot render: FFmpeg not available',
        code: 'FFMPEG_NOT_AVAILABLE',
      });
    }

    const planVersion = await prisma.planVersion.findUnique({
      where: { id: planVersionId },
      include: {
        scenes: { orderBy: { idx: 'asc' } },
        project: true,
      },
    });

    if (!planVersion) {
      return res.status(404).json({ error: 'Plan version not found' });
    }

    // Validate before render
    const validation = validatePlan(planVersion, planVersion.project);

    if (validation.errors.length > 0) {
      return res.status(400).json({
        error: 'Plan has validation errors. Please fix them before rendering.',
        validation,
      });
    }

    // Start render pipeline
    const run = await startRenderPipeline(planVersion);

    res.json(run);
  } catch (error) {
    logError('Error starting render', error);
    res.status(500).json({ error: 'Failed to start render' });
  }
});
