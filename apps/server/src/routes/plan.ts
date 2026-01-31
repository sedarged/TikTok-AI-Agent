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
import { logError } from '../utils/logger.js';

export const planRoutes = Router();

const sceneUpdateSchema = z
  .object({
    id: z.string(),
    narrationText: z.string().optional(),
    onScreenText: z.string().optional(),
    visualPrompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    effectPreset: z.string().optional(),
    durationTargetSec: z.number().optional(),
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

const planVersionIdParamsSchema = z.object({ planVersionId: z.string().uuid() });

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

    // Update plan version fields
    const updateData: {
      hookSelected?: string;
      outline?: string;
      scriptFull?: string;
    } = {};
    if (hookSelected !== undefined) updateData.hookSelected = hookSelected;
    if (outline !== undefined) updateData.outline = outline;
    if (scriptFull !== undefined) updateData.scriptFull = scriptFull;

    if (Object.keys(updateData).length > 0) {
      await prisma.planVersion.update({
        where: { id: planVersionId },
        data: updateData,
      });
    }

    // Update scenes if provided
    if (scenes && Array.isArray(scenes)) {
      for (const scene of scenes) {
        if (!scene.id) continue;

        const existingScene = await prisma.scene.findUnique({
          where: { id: scene.id },
        });

        if (existingScene && !existingScene.isLocked) {
          await prisma.scene.update({
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
        } else if (existingScene && existingScene.isLocked && scene.isLocked === false) {
          // Allow unlocking
          await prisma.scene.update({
            where: { id: scene.id },
            data: { isLocked: false },
          });
        }
      }
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

    const fittedScenes = autofitDurations(planVersion.scenes, planVersion.project);

    // Update scenes in DB
    for (const scene of fittedScenes) {
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          durationTargetSec: scene.durationTargetSec,
          startTimeSec: scene.startTimeSec,
          endTimeSec: scene.endTimeSec,
        },
      });
    }

    // Recalculate estimates
    const totalDuration = fittedScenes.reduce((sum, s) => sum + s.durationTargetSec, 0);
    const totalWords = fittedScenes.reduce(
      (sum, s) => sum + s.narrationText.split(/\s+/).length,
      0
    );
    const wpm = totalDuration > 0 ? (totalWords / totalDuration) * 60 : 0;

    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: {
        estimatesJson: JSON.stringify({
          wpm: Math.round(wpm),
          estimatedLengthSec: Math.round(totalDuration),
          targetLengthSec: planVersion.project.targetLengthSec,
        }),
      },
    });

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

    const hookOptions = await regenerateHooks(planVersion.project);

    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: {
        hookOptionsJson: JSON.stringify(hookOptions),
      },
    });

    res.json({ hookOptions });
  } catch (error) {
    logError('Error regenerating hooks', error);
    res.status(500).json({ error: 'Failed to regenerate hooks' });
  }
});

// Regenerate outline
planRoutes.post('/:planVersionId/regenerate-outline', async (req, res) => {
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

    const outline = await regenerateOutline(planVersion.project, planVersion.hookSelected);

    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: { outline },
    });

    res.json({ outline });
  } catch (error) {
    logError('Error regenerating outline', error);
    res.status(500).json({ error: 'Failed to regenerate outline' });
  }
});

// Regenerate script
planRoutes.post('/:planVersionId/regenerate-script', async (req, res) => {
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

    const { scriptFull, scenes } = await regenerateScript(
      planVersion.project,
      planVersion.hookSelected,
      planVersion.outline,
      planVersion.scenes
    );

    await prisma.planVersion.update({
      where: { id: planVersion.id },
      data: { scriptFull },
    });

    // Update scene narrations
    for (const scene of scenes) {
      await prisma.scene.update({
        where: { id: scene.id },
        data: { narrationText: scene.narrationText },
      });
    }

    const updatedPlan = await prisma.planVersion.findUnique({
      where: { id: planVersion.id },
      include: { scenes: { orderBy: { idx: 'asc' } } },
    });

    res.json(updatedPlan);
  } catch (error) {
    logError('Error regenerating script', error);
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
