import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { getNichePackOrThrow } from '../services/plan/packs.js';
import { validatePlan } from '../services/plan/validate.js';
import { autofitDurations } from '../services/plan/autofit.js';
import type { PlanVersionPayload, ProjectSettings } from '../services/plan/types.js';
import { detectFfmpeg } from '../services/ffmpeg/bin.js';
import { providerStatus } from '../env.js';
import { renderEngine } from '../services/render/engine.js';
import { getOpenAIClientOrThrow } from '../services/providers/openaiClient.js';
import { regenerateHooksOnly, regenerateOutlineOnly, regenerateScriptOnly } from '../services/plan/openaiRegens.js';

export const planRouter = Router();

planRouter.put('/plan/:planVersionId', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const { payload } = req.body as { payload: PlanVersionPayload };
  if (!payload) {
    res.status(400).json({ error: 'Missing payload.' });
    return;
  }

  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true, scenes: true } });
  if (!plan) {
    res.status(404).json({ error: 'PlanVersion not found.' });
    return;
  }

  const settings: ProjectSettings = {
    topic: plan.project.title,
    nichePackId: plan.project.nichePackId,
    language: plan.project.language,
    targetLengthSec: plan.project.targetLengthSec,
    tempo: plan.project.tempo as any,
    voicePreset: plan.project.voicePreset,
    visualStylePreset: plan.project.visualStylePreset ?? null
  };

  // Update scenes by id. Lock only protects from regeneration (not from user edits).
  const existingById = new Map(plan.scenes.map((s) => [s.id, s]));
  for (const s of payload.scenes) {
    const existing = existingById.get(s.id);
    if (!existing) continue;
    const newLock = Boolean(s.lock);
    await prisma.scene.update({
      where: { id: existing.id },
      data: {
        narrationText: s.narrationText,
        onScreenText: s.onScreenText,
        visualPrompt: s.visualPrompt,
        negativePrompt: s.negativePrompt,
        effectPreset: s.effectPreset,
        durationTargetSec: s.durationTargetSec,
        isLocked: newLock
      }
    });
  }

  const updatedPlan = await prisma.planVersion.update({
    where: { id: planVersionId },
    data: {
      hookOptionsJson: JSON.stringify(payload.hookOptions),
      hookSelected: payload.hookSelected,
      outline: payload.outline,
      scriptFull: payload.scriptFull,
      estimatesJson: JSON.stringify(payload.estimates),
      validationJson: JSON.stringify(payload.validation)
    },
    include: { scenes: { orderBy: { idx: 'asc' } }, project: true }
  });

  res.json({ planVersion: updatedPlan });
});

planRouter.post('/plan/:planVersionId/validate', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true, scenes: { orderBy: { idx: 'asc' } } } });
  if (!plan) {
    res.status(404).json({ error: 'PlanVersion not found.' });
    return;
  }
  const pack = await getNichePackOrThrow(plan.project.nichePackId);
  const settings: ProjectSettings = {
    topic: plan.project.title,
    nichePackId: plan.project.nichePackId,
    language: plan.project.language,
    targetLengthSec: plan.project.targetLengthSec,
    tempo: plan.project.tempo as any,
    voicePreset: plan.project.voicePreset,
    visualStylePreset: plan.project.visualStylePreset ?? null
  };

  const payload: Omit<PlanVersionPayload, 'validation'> = {
    hookOptions: JSON.parse(plan.hookOptionsJson),
    hookSelected: plan.hookSelected,
    outline: plan.outline,
    scriptFull: plan.scriptFull,
    scenes: plan.scenes.map((s) => ({
      id: s.id,
      idx: s.idx,
      narrationText: s.narrationText,
      onScreenText: s.onScreenText,
      visualPrompt: s.visualPrompt,
      negativePrompt: s.negativePrompt,
      effectPreset: s.effectPreset as any,
      durationTargetSec: s.durationTargetSec,
      lock: s.isLocked
    })),
    estimates: JSON.parse(plan.estimatesJson)
  };

  const v = validatePlan(settings, pack.config, payload);
  const validation = { errors: v.errors, warnings: v.warnings, suggestions: v.suggestions };
  await prisma.planVersion.update({ where: { id: planVersionId }, data: { validationJson: JSON.stringify(validation) } });
  res.json({ validation, totalDurationSec: v.totalDurationSec });
});

planRouter.post('/plan/:planVersionId/autofit', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true, scenes: { orderBy: { idx: 'asc' } } } });
  if (!plan) {
    res.status(404).json({ error: 'PlanVersion not found.' });
    return;
  }
  const pack = await getNichePackOrThrow(plan.project.nichePackId);

  const scenes = plan.scenes.map((s) => ({
    id: s.id,
    idx: s.idx,
    narrationText: s.narrationText,
    onScreenText: s.onScreenText,
    visualPrompt: s.visualPrompt,
    negativePrompt: s.negativePrompt,
    effectPreset: s.effectPreset as any,
    durationTargetSec: s.durationTargetSec,
    lock: s.isLocked
  }));

  const fitted = autofitDurations(plan.project.targetLengthSec, pack.config, scenes);
  for (const s of fitted) {
    await prisma.scene.update({
      where: { id: s.id },
      data: {
        durationTargetSec: s.durationTargetSec,
        startTimeSec: (s as any).startTimeSec,
        endTimeSec: (s as any).endTimeSec
      }
    });
  }

  res.json({ scenes: await prisma.scene.findMany({ where: { planVersionId }, orderBy: { idx: 'asc' } }) });
});

planRouter.post('/plan/:planVersionId/approve', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true } });
  if (!plan) {
    res.status(404).json({ error: 'PlanVersion not found.' });
    return;
  }
  const validation = JSON.parse(plan.validationJson) as { errors: string[] };
  if (validation.errors?.length) {
    res.status(400).json({ error: 'Plan has validation errors. Fix them before approval.', validation });
    return;
  }
  const updatedProject = await prisma.project.update({ where: { id: plan.projectId }, data: { status: 'APPROVED' } });
  res.json({ project: updatedProject });
});

planRouter.post('/plan/:planVersionId/regenerate/hooks', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true } });
  if (!plan) return res.status(404).json({ error: 'PlanVersion not found.' });

  const pack = await getNichePackOrThrow(plan.project.nichePackId);

  if (!providerStatus.openai) {
    return res.status(400).json({ error: 'Regenerate Hooks blocked: OPENAI_API_KEY is not configured. (Template mode cannot produce true alternate hooks.)' });
  }

  const client = getOpenAIClientOrThrow();
  const out = await regenerateHooksOnly(client, { topic: plan.project.title, language: plan.project.language, hookRules: pack.config.hookRules });
  const hookSelected = out.hookOptions[0];

  const updated = await prisma.planVersion.update({
    where: { id: planVersionId },
    data: { hookOptionsJson: JSON.stringify(out.hookOptions), hookSelected }
  });
  res.json({ planVersion: updated });
});

planRouter.post('/plan/:planVersionId/regenerate/outline', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true, scenes: { orderBy: { idx: 'asc' } } } });
  if (!plan) return res.status(404).json({ error: 'PlanVersion not found.' });

  if (!providerStatus.openai) {
    return res.status(400).json({ error: 'Regenerate Outline blocked: OPENAI_API_KEY is not configured.' });
  }

  const client = getOpenAIClientOrThrow();
  const out = await regenerateOutlineOnly(client, {
    topic: plan.project.title,
    language: plan.project.language,
    hookSelected: plan.hookSelected,
    sceneHeadlines: plan.scenes.map((s) => ({ idx: s.idx, onScreenText: s.onScreenText }))
  });

  const updated = await prisma.planVersion.update({ where: { id: planVersionId }, data: { outline: out.outline } });
  res.json({ planVersion: updated });
});

planRouter.post('/plan/:planVersionId/regenerate/script', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true, scenes: { orderBy: { idx: 'asc' } } } });
  if (!plan) return res.status(404).json({ error: 'PlanVersion not found.' });

  if (!providerStatus.openai) {
    return res.status(400).json({ error: 'Regenerate Script blocked: OPENAI_API_KEY is not configured.' });
  }

  const client = getOpenAIClientOrThrow();
  const scenes = plan.scenes.map((s) => ({
    id: s.id,
    idx: s.idx,
    narrationText: s.narrationText,
    onScreenText: s.onScreenText,
    visualPrompt: s.visualPrompt,
    negativePrompt: s.negativePrompt,
    effectPreset: s.effectPreset as any,
    durationTargetSec: s.durationTargetSec,
    lock: s.isLocked
  }));
  const out = await regenerateScriptOnly(client, {
    topic: plan.project.title,
    language: plan.project.language,
    targetLengthSec: plan.project.targetLengthSec,
    tempo: plan.project.tempo,
    hookSelected: plan.hookSelected,
    outline: plan.outline,
    scenes: scenes as any
  });

  // Respect locks: only update unlocked scenes.
  for (const s of out.scenes) {
    const existing = plan.scenes.find((x) => x.id === s.id);
    if (!existing) continue;
    if (existing.isLocked) continue;
    await prisma.scene.update({ where: { id: existing.id }, data: { narrationText: s.narrationText, onScreenText: s.onScreenText } });
  }

  const updated = await prisma.planVersion.update({ where: { id: planVersionId }, data: { scriptFull: out.scriptFull } });
  res.json({ planVersion: updated });
});

planRouter.post('/plan/:planVersionId/render', async (req, res) => {
  const planVersionId = req.params.planVersionId;
  const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId }, include: { project: true } });
  if (!plan) {
    res.status(404).json({ error: 'PlanVersion not found.' });
    return;
  }

  if (plan.project.status !== 'APPROVED') {
    res.status(400).json({ error: `Render blocked: project status is ${plan.project.status}. Approve the plan first.` });
    return;
  }
  if (!providerStatus.openai) {
    res.status(400).json({ error: 'Render blocked: OPENAI_API_KEY is not configured on the server.' });
    return;
  }
  const ff = detectFfmpeg();
  if (!ff.ffmpegPath || !ff.ffprobePath) {
    res.status(400).json({ error: 'Render blocked: FFmpeg/ffprobe is not available (install system ffmpeg or enable ffmpeg-static).' });
    return;
  }

  const run = await prisma.run.create({
    data: {
      projectId: plan.projectId,
      planVersionId: plan.id,
      status: 'queued',
      progress: 0,
      currentStep: null,
      logsJson: '[]',
      artifactsJson: '{}',
      resumeStateJson: '{}'
    }
  });

  await prisma.project.update({ where: { id: plan.projectId }, data: { status: 'RENDERING' } });

  // Start async render.
  setTimeout(() => {
    renderEngine.start(run.id, null).catch(() => {});
  }, 10);

  res.json({ run });
});

