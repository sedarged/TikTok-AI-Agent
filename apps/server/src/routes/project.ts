import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import type { ProjectSettings } from '../services/plan/types.js';
import { generatePlan } from '../services/plan/planService.js';
import { getNichePackOrThrow } from '../services/plan/packs.js';
import { autofitDurations } from '../services/plan/autofit.js';
import { validatePlan } from '../services/plan/validate.js';

export const projectRouter = Router();

projectRouter.get('/projects', async (_req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ projects });
});

projectRouter.post('/project', async (req, res) => {
  const settings = req.body as ProjectSettings;
  const missing = requiredMissing(settings);
  if (missing.length) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    return;
  }

  const title = settings.topic.trim().slice(0, 60);
  const project = await prisma.project.create({
    data: {
      title,
      nichePackId: settings.nichePackId,
      language: settings.language,
      targetLengthSec: Math.round(settings.targetLengthSec),
      tempo: settings.tempo,
      voicePreset: settings.voicePreset,
      visualStylePreset: settings.visualStylePreset ?? null,
      status: 'DRAFT_PLAN'
    }
  });

  res.json({ project });
});

projectRouter.post('/project/:id/plan', async (req, res) => {
  const projectId = req.params.id;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const settings: ProjectSettings = {
    topic: project.title,
    nichePackId: project.nichePackId,
    language: project.language,
    targetLengthSec: project.targetLengthSec,
    tempo: project.tempo as any,
    voicePreset: project.voicePreset,
    visualStylePreset: project.visualStylePreset ?? null
  };

  const pack = await getNichePackOrThrow(project.nichePackId);
  const { payload, templateMode } = await generatePlan(settings);

  // Auto-fit durations & compute timeline for saved scenes.
  const fitted = autofitDurations(settings.targetLengthSec, pack.config, payload.scenes);
  const basePayload = { ...payload, scenes: fitted.map((s) => ({ ...s, lock: s.lock })) } as any;
  const v = validatePlan(settings, pack.config, basePayload);
  basePayload.validation = { errors: v.errors, warnings: v.warnings, suggestions: v.suggestions };

  const planVersion = await prisma.planVersion.create({
    data: {
      projectId,
      hookOptionsJson: JSON.stringify(basePayload.hookOptions),
      hookSelected: basePayload.hookSelected,
      outline: basePayload.outline,
      scriptFull: basePayload.scriptFull,
      estimatesJson: JSON.stringify(basePayload.estimates),
      validationJson: JSON.stringify(basePayload.validation),
      scenes: {
        create: fitted.map((s, idx) => ({
          projectId,
          idx,
          narrationText: s.narrationText,
          onScreenText: s.onScreenText,
          visualPrompt: s.visualPrompt,
          negativePrompt: s.negativePrompt,
          effectPreset: s.effectPreset,
          durationTargetSec: s.durationTargetSec,
          startTimeSec: (s as any).startTimeSec ?? idx * s.durationTargetSec,
          endTimeSec: (s as any).endTimeSec ?? (idx + 1) * s.durationTargetSec,
          isLocked: s.lock
        }))
      }
    },
    include: { scenes: { orderBy: { idx: 'asc' } } }
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'PLAN_READY', latestPlanVersionId: planVersion.id }
  });

  res.json({ planVersion, templateMode });
});

projectRouter.get('/project/:id', async (req, res) => {
  const id = req.params.id;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      planVersions: { orderBy: { createdAt: 'desc' }, take: 5 },
      scenes: { orderBy: { idx: 'asc' } }
    }
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const latestPlanId = project.latestPlanVersionId;
  const latestPlan = latestPlanId
    ? await prisma.planVersion.findUnique({ where: { id: latestPlanId }, include: { scenes: { orderBy: { idx: 'asc' } } } })
    : null;

  res.json({ project, latestPlan });
});

projectRouter.get('/project/:id/runs', async (req, res) => {
  const id = req.params.id;
  const runs = await prisma.run.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ runs });
});

projectRouter.post('/project/:id/duplicate', async (req, res) => {
  const id = req.params.id;
  const { topic } = (req.body ?? {}) as { topic?: string };
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  if (!project.latestPlanVersionId) {
    res.status(400).json({ error: 'Duplicate blocked: project has no plan to duplicate.' });
    return;
  }

  const plan = await prisma.planVersion.findUnique({
    where: { id: project.latestPlanVersionId },
    include: { scenes: { orderBy: { idx: 'asc' } } }
  });
  if (!plan) {
    res.status(400).json({ error: 'Duplicate blocked: latest plan not found.' });
    return;
  }

  const newTitle = (topic && topic.trim()) ? topic.trim() : `Copy of ${project.title}`.slice(0, 60);
  const newProject = await prisma.project.create({
    data: {
      title: newTitle.slice(0, 60),
      nichePackId: project.nichePackId,
      language: project.language,
      targetLengthSec: project.targetLengthSec,
      tempo: project.tempo,
      voicePreset: project.voicePreset,
      visualStylePreset: project.visualStylePreset,
      status: 'PLAN_READY'
    }
  });

  const newPlan = await prisma.planVersion.create({
    data: {
      projectId: newProject.id,
      hookOptionsJson: plan.hookOptionsJson,
      hookSelected: plan.hookSelected,
      outline: plan.outline,
      scriptFull: plan.scriptFull,
      estimatesJson: plan.estimatesJson,
      validationJson: plan.validationJson,
      scenes: {
        create: plan.scenes.map((s) => ({
          projectId: newProject.id,
          idx: s.idx,
          narrationText: s.narrationText,
          onScreenText: s.onScreenText,
          visualPrompt: s.visualPrompt,
          negativePrompt: s.negativePrompt,
          effectPreset: s.effectPreset,
          durationTargetSec: s.durationTargetSec,
          startTimeSec: s.startTimeSec,
          endTimeSec: s.endTimeSec,
          isLocked: s.isLocked
        }))
      }
    }
  });

  await prisma.project.update({ where: { id: newProject.id }, data: { latestPlanVersionId: newPlan.id } });

  res.json({ project: newProject, planVersionId: newPlan.id });
});

function requiredMissing(s: any) {
  const missing: string[] = [];
  if (!s?.topic) missing.push('topic');
  if (!s?.nichePackId) missing.push('nichePackId');
  if (!s?.language) missing.push('language');
  if (!s?.targetLengthSec) missing.push('targetLengthSec');
  if (!s?.tempo) missing.push('tempo');
  if (!s?.voicePreset) missing.push('voicePreset');
  return missing;
}

