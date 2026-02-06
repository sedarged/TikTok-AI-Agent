import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { regenerateScene } from '../services/plan/planGenerator.js';
import { logError } from '../utils/logger.js';

export const sceneRoutes = Router();

const sceneUpdateSchema = z
  .object({
    narrationText: z.string().optional(),
    onScreenText: z.string().optional(),
    visualPrompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    effectPreset: z.string().optional(),
    durationTargetSec: z.number().positive().optional(),
    isLocked: z.boolean().optional(),
  })
  .strict();

const sceneLockSchema = z
  .object({
    locked: z.boolean(),
  })
  .strict();

const sceneIdParamsSchema = z.object({ sceneId: z.uuid() });

// Get single scene
sceneRoutes.get('/:sceneId', async (req, res) => {
  try {
    const parsed = sceneIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid scene ID', details: parsed.error.flatten() });
    }
    const { sceneId } = parsed.data;
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
    });

    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    res.json(scene);
  } catch (error) {
    logError('Error getting scene', error);
    res.status(500).json({ error: 'Failed to get scene' });
  }
});

// Update single scene
sceneRoutes.put('/:sceneId', async (req, res) => {
  try {
    const parsedParams = sceneIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ error: 'Invalid scene ID', details: parsedParams.error.flatten() });
    }
    const { sceneId } = parsedParams.data;
    const parsed = sceneUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid scene update payload',
        details: parsed.error.flatten(),
      });
    }

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
    });

    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    if (scene.isLocked && parsed.data.isLocked !== false) {
      return res.status(400).json({ error: 'Scene is locked. Unlock it first to make changes.' });
    }

    const updatedScene = await prisma.scene.update({
      where: { id: sceneId },
      data: {
        narrationText: parsed.data.narrationText ?? scene.narrationText,
        onScreenText: parsed.data.onScreenText ?? scene.onScreenText,
        visualPrompt: parsed.data.visualPrompt ?? scene.visualPrompt,
        negativePrompt: parsed.data.negativePrompt ?? scene.negativePrompt,
        effectPreset: parsed.data.effectPreset ?? scene.effectPreset,
        durationTargetSec: parsed.data.durationTargetSec ?? scene.durationTargetSec,
        isLocked: parsed.data.isLocked ?? scene.isLocked,
      },
    });

    res.json(updatedScene);
  } catch (error) {
    logError('Error updating scene', error);
    res.status(500).json({ error: 'Failed to update scene' });
  }
});

// Lock/unlock scene
sceneRoutes.post('/:sceneId/lock', async (req, res) => {
  try {
    const parsedParams = sceneIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ error: 'Invalid scene ID', details: parsedParams.error.flatten() });
    }
    const { sceneId } = parsedParams.data;
    const parsed = sceneLockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid lock payload',
        details: parsed.error.flatten(),
      });
    }

    const { locked } = parsed.data;

    // P1-5 & P3-1 FIX: Check scene exists before updating and handle P2025 error
    const existingScene = await prisma.scene.findUnique({ where: { id: sceneId } });
    if (!existingScene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const scene = await prisma.scene.update({
      where: { id: sceneId },
      data: { isLocked: locked },
    });

    res.json(scene);
  } catch (error) {
    // This P2025 error can still occur if the scene is deleted between the existence check above
    // and the update call (race condition). Treat it as a 404 instead of a 500 for
    // defense-in-depth, even though the normal path should be covered by findUnique.
    if ((error as { code?: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Scene not found' });
    }
    logError('Error toggling scene lock', error);
    res.status(500).json({ error: 'Failed to toggle scene lock' });
  }
});

// Regenerate single scene
sceneRoutes.post('/:sceneId/regenerate', async (req, res) => {
  try {
    const parsed = sceneIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid scene ID', details: parsed.error.flatten() });
    }
    const { sceneId } = parsed.data;
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        planVersion: {
          include: {
            project: true,
            scenes: {
              orderBy: { idx: 'asc' },
            },
          },
        },
      },
    });

    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    if (scene.isLocked) {
      return res.status(400).json({ error: 'Cannot regenerate a locked scene. Unlock it first.' });
    }

    const regeneratedScene = await regenerateScene(
      scene,
      scene.planVersion.project,
      scene.planVersion.scenes
    );

    // Update scene in DB
    const updatedScene = await prisma.scene.update({
      where: { id: scene.id },
      data: {
        narrationText: regeneratedScene.narrationText,
        onScreenText: regeneratedScene.onScreenText,
        visualPrompt: regeneratedScene.visualPrompt,
        negativePrompt: regeneratedScene.negativePrompt,
      },
    });

    res.json(updatedScene);
  } catch (error) {
    logError('Error regenerating scene', error);
    res.status(500).json({ error: 'Failed to regenerate scene' });
  }
});
