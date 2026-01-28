import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { getNichePackOrThrow } from '../services/plan/packs.js';
import { regenerateScene } from '../services/plan/regenerateScene.js';

export const sceneRouter = Router();

sceneRouter.post('/scene/:sceneId/regenerate', async (req, res) => {
  const sceneId = req.params.sceneId;
  const scene = await prisma.scene.findUnique({ where: { id: sceneId }, include: { planVersion: { include: { project: true, scenes: { orderBy: { idx: 'asc' } } } } } });
  if (!scene) {
    res.status(404).json({ error: 'Scene not found.' });
    return;
  }
  if (scene.isLocked) {
    res.status(400).json({ error: 'Scene is locked and cannot be regenerated.' });
    return;
  }

  const pack = await getNichePackOrThrow(scene.planVersion.project.nichePackId);
  const updated = await regenerateScene({
    pack,
    project: scene.planVersion.project,
    plan: scene.planVersion,
    scene
  });

  res.json({ scene: updated });
});

