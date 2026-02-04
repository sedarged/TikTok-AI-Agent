import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { generatePlan } from '../services/plan/planGenerator.js';
import { getNichePack } from '../services/nichePacks.js';
import { v4 as uuid } from 'uuid';
import { logError } from '../utils/logger.js';

export const projectRoutes = Router();

const createProjectSchema = z
  .object({
    topic: z.string().min(1).max(500),
    nichePackId: z.string().min(1),
    language: z.string().min(1).max(10).optional(),
    targetLengthSec: z.number().int().positive().max(600).optional(),
    tempo: z.enum(['slow', 'normal', 'fast']).optional(),
    voicePreset: z.string().min(1).max(50).optional(),
    visualStylePreset: z.string().nullable().optional(),
    seoKeywords: z.string().max(500).optional(),
  })
  .strict();

const projectIdParamsSchema = z.object({ id: z.uuid() });

const generatePlanBodySchema = z
  .object({
    scriptTemplateId: z.string().min(1).max(50).optional(),
  })
  .strict();

// List all projects
projectRoutes.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        planVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    res.json(projects);
  } catch (error) {
    logError('Error listing projects', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Create new project
projectRoutes.post('/', async (req, res) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid project payload',
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
      seoKeywords,
    } = parsed.data;

    if (!topic || !nichePackId) {
      return res.status(400).json({ error: 'Topic and nichePackId are required' });
    }

    const pack = getNichePack(nichePackId);
    if (!pack) {
      return res.status(400).json({ error: 'Invalid niche pack' });
    }

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

    res.json(project);
  } catch (error) {
    logError('Error creating project', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get single project with latest plan version
projectRoutes.get('/:id', async (req, res) => {
  try {
    const parsed = projectIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid project ID', details: parsed.error.flatten() });
    }
    const { id } = parsed.data;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        planVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            scenes: {
              orderBy: { idx: 'asc' },
            },
          },
        },
        runs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    logError('Error getting project', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Generate plan for project
projectRoutes.post('/:id/plan', async (req, res) => {
  try {
    const parsed = projectIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid project ID', details: parsed.error.flatten() });
    }
    const bodyParsed = generatePlanBodySchema.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: bodyParsed.error.flatten(),
      });
    }
    const { id } = parsed.data;
    const body = bodyParsed.data;
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const planVersion = await generatePlan(project, {
      scriptTemplateId: body.scriptTemplateId,
    });

    // Update project with latest plan version
    await prisma.project.update({
      where: { id: project.id },
      data: {
        latestPlanVersionId: planVersion.id,
        status: 'PLAN_READY',
      },
    });

    // Fetch with scenes
    const fullPlanVersion = await prisma.planVersion.findUnique({
      where: { id: planVersion.id },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
        },
      },
    });

    res.json(fullPlanVersion);
  } catch (error) {
    logError('Error generating plan', error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Failed to generate plan' });
  }
});

// Get project runs
projectRoutes.get('/:id/runs', async (req, res) => {
  try {
    const parsed = projectIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid project ID', details: parsed.error.flatten() });
    }
    const { id } = parsed.data;
    const runs = await prisma.run.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(runs);
  } catch (error) {
    logError('Error getting runs', error);
    res.status(500).json({ error: 'Failed to get runs' });
  }
});

// Duplicate project
projectRoutes.post('/:id/duplicate', async (req, res) => {
  try {
    const parsed = projectIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid project ID', details: parsed.error.flatten() });
    }
    const { id } = parsed.data;
    const original = await prisma.project.findUnique({
      where: { id },
      include: {
        planVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            scenes: {
              orderBy: { idx: 'asc' },
            },
          },
        },
      },
    });

    if (!original) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const newProjectId = uuid();
    const newPlanVersionId = uuid();

    // Create new project
    const newProject = await prisma.project.create({
      data: {
        id: newProjectId,
        title: `${original.title} (Copy)`,
        topic: original.topic,
        nichePackId: original.nichePackId,
        language: original.language,
        targetLengthSec: original.targetLengthSec,
        tempo: original.tempo,
        voicePreset: original.voicePreset,
        visualStylePreset: original.visualStylePreset,
        seoKeywords: original.seoKeywords,
        status: 'DRAFT_PLAN',
      },
    });

    // Copy plan version if exists
    if (original.planVersions.length > 0) {
      const originalPlan = original.planVersions[0];

      await prisma.planVersion.create({
        data: {
          id: newPlanVersionId,
          projectId: newProjectId,
          hookOptionsJson: originalPlan.hookOptionsJson,
          hookSelected: originalPlan.hookSelected,
          outline: originalPlan.outline,
          scriptFull: originalPlan.scriptFull,
          estimatesJson: originalPlan.estimatesJson,
          validationJson: originalPlan.validationJson,
        },
      });

      // Copy scenes
      for (const scene of originalPlan.scenes) {
        await prisma.scene.create({
          data: {
            id: uuid(),
            projectId: newProjectId,
            planVersionId: newPlanVersionId,
            idx: scene.idx,
            narrationText: scene.narrationText,
            onScreenText: scene.onScreenText,
            visualPrompt: scene.visualPrompt,
            negativePrompt: scene.negativePrompt,
            effectPreset: scene.effectPreset,
            durationTargetSec: scene.durationTargetSec,
            startTimeSec: scene.startTimeSec,
            endTimeSec: scene.endTimeSec,
            isLocked: false,
          },
        });
      }

      await prisma.project.update({
        where: { id: newProjectId },
        data: {
          latestPlanVersionId: newPlanVersionId,
          status: 'PLAN_READY',
        },
      });
    }

    res.json(newProject);
  } catch (error) {
    logError('Error duplicating project', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

// Delete project
projectRoutes.delete('/:id', async (req, res) => {
  try {
    const parsed = projectIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid project ID', details: parsed.error.flatten() });
    }
    const { id } = parsed.data;
    await prisma.project.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (error) {
    logError('Error deleting project', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});
