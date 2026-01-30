import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { regenerateScene } from '../services/plan/planGenerator.js';

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

const sceneIdParamsSchema = z.object({ sceneId: z.string().uuid() });

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
    console.error('Error getting scene:', error);
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
    console.error('Error updating scene:', error);
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

    const scene = await prisma.scene.update({
      where: { id: sceneId },
      data: { isLocked: locked },
    });

    res.json(scene);
  } catch (error) {
    console.error('Error toggling scene lock:', error);
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
    console.error('Error regenerating scene:', error);
    res.status(500).json({ error: 'Failed to regenerate scene' });
  }
});
