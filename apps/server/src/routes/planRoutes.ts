import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { planVersionToPayload } from "../services/plan/planMapper.js";
import { autoFitDurations, computeSceneTimings } from "../services/plan/autofit.js";
import { getNichePack } from "../services/plan/nichePacks.js";
import { validatePlan } from "../services/plan/validation.js";
import {
  generateHooks,
  regenerateOutline,
  regenerateScript
} from "../services/plan/planGenerator.js";
import { providerStatus } from "../env.js";
import { regenerateScene } from "../services/plan/sceneRegenerator.js";
import { runPipeline } from "../services/render/pipeline.js";
import { appendRunLog, markRunStatus } from "../services/render/runLog.js";

export const planRouter = Router();

const SceneSchema = z.object({
  id: z.string(),
  idx: z.number(),
  narrationText: z.string(),
  onScreenText: z.string(),
  visualPrompt: z.string(),
  negativePrompt: z.string(),
  effectPreset: z.string(),
  durationTargetSec: z.number(),
  lock: z.boolean()
});

const PlanPayloadSchema = z.object({
  hookOptions: z.array(z.string()),
  hookSelected: z.string(),
  outline: z.string(),
  scriptFull: z.string(),
  scenes: z.array(SceneSchema),
  estimates: z.object({
    wpm: z.number(),
    estimatedLengthSec: z.number(),
    targetLengthSec: z.number()
  }),
  validation: z.object({
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    suggestions: z.array(z.string())
  })
});

planRouter.put("/plan/:planVersionId", async (req, res) => {
  const parsed = PlanPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan payload." });
    return;
  }
  const payload = parsed.data;
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  const validated = validatePlan(pack, payload);
  const timings = computeSceneTimings(payload.scenes.map((scene) => scene.durationTargetSec));

  await prisma.planVersion.update({
    where: { id: plan.id },
    data: {
      hookOptionsJson: payload.hookOptions,
      hookSelected: payload.hookSelected,
      outline: payload.outline,
      scriptFull: payload.scriptFull,
      estimatesJson: payload.estimates,
      validationJson: validated
    }
  });

  for (const scene of payload.scenes) {
    await prisma.scene.update({
      where: { id: scene.id },
      data: {
        narrationText: scene.narrationText,
        onScreenText: scene.onScreenText,
        visualPrompt: scene.visualPrompt,
        negativePrompt: scene.negativePrompt,
        effectPreset: scene.effectPreset as any,
        durationTargetSec: scene.durationTargetSec,
        startTimeSec: timings[scene.idx]?.start ?? 0,
        endTimeSec: timings[scene.idx]?.end ?? scene.durationTargetSec,
        isLocked: scene.lock
      }
    });
  }

  const updatedScenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  res.json({
    plan: {
      ...payload,
      validation: validated,
      scenes: updatedScenes.map((scene) => ({
        id: scene.id,
        idx: scene.idx,
        narrationText: scene.narrationText,
        onScreenText: scene.onScreenText,
        visualPrompt: scene.visualPrompt,
        negativePrompt: scene.negativePrompt,
        effectPreset: scene.effectPreset,
        durationTargetSec: Number(scene.durationTargetSec),
        lock: scene.isLocked
      }))
    }
  });
});

planRouter.post("/plan/:planVersionId/validate", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const payload = planVersionToPayload(plan, scenes);
  const validation = validatePlan(pack, payload);
  await prisma.planVersion.update({
    where: { id: plan.id },
    data: { validationJson: validation }
  });
  res.json({ validation });
});

planRouter.post("/plan/:planVersionId/autofit", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const payload = planVersionToPayload(plan, scenes);
  const fitted = autoFitDurations(payload, pack);
  const timings = computeSceneTimings(fitted.scenes.map((scene) => scene.durationTargetSec));
  for (const scene of fitted.scenes) {
    await prisma.scene.update({
      where: { id: scene.id },
      data: {
        durationTargetSec: scene.durationTargetSec,
        startTimeSec: timings[scene.idx]?.start ?? 0,
        endTimeSec: timings[scene.idx]?.end ?? scene.durationTargetSec
      }
    });
  }
  await prisma.planVersion.update({
    where: { id: plan.id },
    data: {
      estimatesJson: fitted.estimates
    }
  });
  res.json({ plan: fitted });
});

planRouter.post("/plan/:planVersionId/approve", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const payload = planVersionToPayload(plan, scenes);
  const validation = validatePlan(pack, payload);
  if (validation.errors.length) {
    res.status(400).json({ error: "Plan has validation errors.", validation });
    return;
  }
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "APPROVED" }
  });
  await prisma.planVersion.update({
    where: { id: plan.id },
    data: { validationJson: validation }
  });
  res.json({ status: "approved" });
});

planRouter.post("/plan/:planVersionId/render", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!providerStatus.openaiConfigured) {
    res.status(400).json({ error: "OpenAI API key missing. Rendering is blocked." });
    return;
  }
  if (project.status !== "APPROVED") {
    res.status(400).json({ error: "Project must be approved before rendering." });
    return;
  }
  const run = await prisma.run.create({
    data: {
      projectId: project.id,
      planVersionId: plan.id,
      status: "queued",
      progress: 0,
      currentStep: "queued",
      logsJson: [],
      artifactsJson: {},
      resumeStateJson: {}
    }
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "RENDERING" }
  });
  await appendRunLog(run.id, "Run queued.");
  runPipeline(run.id)
    .then(async () => {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "DONE" }
      });
    })
    .catch(async (error) => {
      await markRunStatus(run.id, "failed");
      await appendRunLog(run.id, `Pipeline failed: ${(error as Error).message}`);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "FAILED" }
      });
    });
  res.json({ runId: run.id });
});

planRouter.post("/plan/:planVersionId/regenerate/hooks", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  if (!providerStatus.openaiConfigured) {
    res.status(400).json({ error: "OpenAI API key missing. Hook regeneration blocked." });
    return;
  }
  const hookOptions = await generateHooks(
    {
      topic: project.title,
      nichePackId: project.nichePackId,
      language: project.language,
      targetLengthSec: project.targetLengthSec,
      tempo: project.tempo as "slow" | "normal" | "fast",
      voicePreset: project.voicePreset,
      visualStylePreset: project.visualStylePreset
    },
    pack
  );
  const selected = hookOptions.includes(plan.hookSelected) ? plan.hookSelected : hookOptions[0];
  await prisma.planVersion.update({
    where: { id: plan.id },
    data: { hookOptionsJson: hookOptions, hookSelected: selected }
  });
  res.json({ hookOptions, hookSelected: selected });
});

planRouter.post("/plan/:planVersionId/regenerate/outline", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  if (!providerStatus.openaiConfigured) {
    res.status(400).json({ error: "OpenAI API key missing. Outline regeneration blocked." });
    return;
  }
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const payload = planVersionToPayload(plan, scenes);
  const outline = await regenerateOutline(
    {
      topic: project.title,
      nichePackId: project.nichePackId,
      language: project.language,
      targetLengthSec: project.targetLengthSec,
      tempo: project.tempo as "slow" | "normal" | "fast",
      voicePreset: project.voicePreset,
      visualStylePreset: project.visualStylePreset
    },
    pack,
    payload.hookSelected,
    payload.scenes
  );
  await prisma.planVersion.update({ where: { id: plan.id }, data: { outline } });
  res.json({ outline });
});

planRouter.post("/plan/:planVersionId/regenerate/script", async (req, res) => {
  const plan = await prisma.planVersion.findUnique({ where: { id: req.params.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!providerStatus.openaiConfigured) {
    res.status(400).json({ error: "OpenAI API key missing. Script regeneration blocked." });
    return;
  }
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const payload = planVersionToPayload(plan, scenes);
  const result = await regenerateScript(
    {
      topic: project.title,
      nichePackId: project.nichePackId,
      language: project.language,
      targetLengthSec: project.targetLengthSec,
      tempo: project.tempo as "slow" | "normal" | "fast",
      voicePreset: project.voicePreset,
      visualStylePreset: project.visualStylePreset
    },
    payload.scenes,
    payload.outline,
    payload.hookSelected
  );
  await prisma.planVersion.update({
    where: { id: plan.id },
    data: { scriptFull: result.scriptFull }
  });
  for (const scene of result.scenes) {
    await prisma.scene.update({
      where: { id: scene.id },
      data: { narrationText: scene.narrationText }
    });
  }
  res.json({ scriptFull: result.scriptFull, scenes: result.scenes });
});

planRouter.post("/scene/:sceneId/regenerate", async (req, res) => {
  const scene = await prisma.scene.findUnique({ where: { id: req.params.sceneId } });
  if (!scene) {
    res.status(404).json({ error: "Scene not found." });
    return;
  }
  if (scene.isLocked) {
    res.status(400).json({ error: "Scene is locked and cannot be regenerated." });
    return;
  }
  const plan = await prisma.planVersion.findUnique({ where: { id: scene.planVersionId } });
  if (!plan) {
    res.status(404).json({ error: "Plan not found." });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!providerStatus.openaiConfigured) {
    res.status(400).json({ error: "OpenAI API key missing. Scene regeneration blocked." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Niche pack not found." });
    return;
  }
  const allScenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const payloadScene = {
    id: scene.id,
    idx: scene.idx,
    narrationText: scene.narrationText,
    onScreenText: scene.onScreenText,
    visualPrompt: scene.visualPrompt,
    negativePrompt: scene.negativePrompt,
    effectPreset: scene.effectPreset as any,
    durationTargetSec: Number(scene.durationTargetSec),
    lock: scene.isLocked
  };
  const neighbors = allScenes
    .filter((s) => Math.abs(s.idx - scene.idx) <= 1 && s.id !== scene.id)
    .map((s) => ({
      id: s.id,
      idx: s.idx,
      narrationText: s.narrationText,
      onScreenText: s.onScreenText,
      visualPrompt: s.visualPrompt,
      negativePrompt: s.negativePrompt,
      effectPreset: s.effectPreset as any,
      durationTargetSec: Number(s.durationTargetSec),
      lock: s.isLocked
    }));
  const regenerated = await regenerateScene(
    {
      topic: project.title,
      nichePackId: project.nichePackId,
      language: project.language,
      targetLengthSec: project.targetLengthSec,
      tempo: project.tempo as "slow" | "normal" | "fast",
      voicePreset: project.voicePreset,
      visualStylePreset: project.visualStylePreset
    },
    pack,
    payloadScene,
    neighbors
  );
  await prisma.scene.update({
    where: { id: scene.id },
    data: {
      narrationText: regenerated.narrationText,
      onScreenText: regenerated.onScreenText,
      visualPrompt: regenerated.visualPrompt,
      negativePrompt: regenerated.negativePrompt,
      effectPreset: regenerated.effectPreset as any,
      durationTargetSec: regenerated.durationTargetSec
    }
  });
  res.json({ scene: regenerated });
});
