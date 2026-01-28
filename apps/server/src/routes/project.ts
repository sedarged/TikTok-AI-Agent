import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { NICHE_PACKS } from '../services/plan/nichePacks';
import { generatePlan } from '../services/plan/generator';
import { ProjectSettings } from '../types';

const router = Router();
const prisma = new PrismaClient();

// ... existing routes ...

// Get Niche Packs
router.get('/niche-packs', (req, res) => {
  res.json(Object.values(NICHE_PACKS));
});

// Create Project
router.post('/project', async (req, res) => {
  try {
    const { topic, nichePackId, language, targetLengthSec, tempo, voicePreset, visualStylePreset } = req.body;

    // Basic validation
    if (!topic || !nichePackId) {
       res.status(400).json({ error: 'Missing required fields' });
       return;
    }

    const project = await prisma.project.create({
      data: {
        title: topic.substring(0, 50),
        nichePackId,
        language: language || 'en',
        targetLengthSec: Number(targetLengthSec) || 60,
        tempo: tempo || 'normal',
        voicePreset: voicePreset || 'default',
        visualStylePreset: visualStylePreset || null,
        status: 'DRAFT_PLAN',
      },
    });

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get Project
router.get('/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        planVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { scenes: { orderBy: { idx: 'asc' } } }
        }
      }
    });

    if (!project) {
       res.status(404).json({ error: 'Project not found' });
       return;
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Generate Plan (Heavy logic)
router.post('/project/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
       res.status(404).json({ error: 'Project not found' });
       return;
    }

    // Call the generator service
    const plan = await generatePlan(project);

    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// Update Plan (Autosave)
router.put('/plan/:planVersionId', async (req, res) => {
  try {
    const { planVersionId } = req.params;
    const { hookSelected, outline, scriptFull, scenes } = req.body;

    const plan = await prisma.planVersion.update({
      where: { id: planVersionId },
      data: {
        hookSelected,
        outline,
        scriptFull,
      }
    });

    // Update scenes if provided
    if (scenes && Array.isArray(scenes)) {
      // Transactional update would be better, but doing loop for simplicity
      for (const scene of scenes) {
        if (scene.id) {
            await prisma.scene.update({
            where: { id: scene.id },
            data: {
              narrationText: scene.narrationText,
              onScreenText: scene.onScreenText,
              visualPrompt: scene.visualPrompt,
              negativePrompt: scene.negativePrompt,
              effectPreset: scene.effectPreset,
              durationTargetSec: scene.durationTargetSec,
              isLocked: scene.lock || scene.isLocked
            }
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

export { router as projectRouter };
