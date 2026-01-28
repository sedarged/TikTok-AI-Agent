import { Router } from 'express';
import { prisma } from '../db/client.js';
import { regenerateScene } from '../services/plan/planGenerator.js';

export const sceneRoutes = Router();

// Get single scene
sceneRoutes.get('/:sceneId', async (req, res) => {
  try {
    const scene = await prisma.scene.findUnique({
      where: { id: req.params.sceneId },
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
    const scene = await prisma.scene.findUnique({
      where: { id: req.params.sceneId },
    });

    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    if (scene.isLocked && req.body.isLocked !== false) {
      return res.status(400).json({ error: 'Scene is locked. Unlock it first to make changes.' });
    }

    const updatedScene = await prisma.scene.update({
      where: { id: req.params.sceneId },
      data: {
        narrationText: req.body.narrationText ?? scene.narrationText,
        onScreenText: req.body.onScreenText ?? scene.onScreenText,
        visualPrompt: req.body.visualPrompt ?? scene.visualPrompt,
        negativePrompt: req.body.negativePrompt ?? scene.negativePrompt,
        effectPreset: req.body.effectPreset ?? scene.effectPreset,
        durationTargetSec: req.body.durationTargetSec ?? scene.durationTargetSec,
        isLocked: req.body.isLocked ?? scene.isLocked,
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
    const { locked } = req.body;
    
    const scene = await prisma.scene.update({
      where: { id: req.params.sceneId },
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
    const scene = await prisma.scene.findUnique({
      where: { id: req.params.sceneId },
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
