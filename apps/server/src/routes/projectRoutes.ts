import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { getNichePack } from "../services/plan/nichePacks.js";
import { buildPlanPayload } from "../services/plan/planGenerator.js";
import { generateTemplatePlan } from "../services/plan/templateMode.js";
import { providerStatus } from "../env.js";
import { planVersionToPayload } from "../services/plan/planMapper.js";
import { computeSceneTimings } from "../services/plan/autofit.js";

export const projectRouter = Router();

const ProjectSettingsSchema = z.object({
  topic: z.string().min(1),
  nichePackId: z.string().min(1),
  language: z.string().min(1),
  targetLengthSec: z.number().min(30),
  tempo: z.enum(["slow", "normal", "fast"]),
  voicePreset: z.string().min(1),
  visualStylePreset: z.string().nullable()
});

projectRouter.get("/projects", async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.json({ projects });
});

projectRouter.post("/project", async (req, res) => {
  const parsed = ProjectSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project settings.", details: parsed.error.flatten() });
    return;
  }
  const settings = parsed.data;
  const pack = await getNichePack(settings.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Unknown niche pack." });
    return;
  }
  const project = await prisma.project.create({
    data: {
      title: settings.topic,
      nichePackId: settings.nichePackId,
      language: settings.language,
      targetLengthSec: settings.targetLengthSec,
      tempo: settings.tempo,
      voicePreset: settings.voicePreset,
      visualStylePreset: settings.visualStylePreset,
      status: "DRAFT_PLAN"
    }
  });
  res.json({ project });
});

projectRouter.get("/project/:id", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const planVersionId = project.latestPlanVersionId;
  let planPayload = null;
  if (planVersionId) {
    const plan = await prisma.planVersion.findUnique({ where: { id: planVersionId } });
    if (plan) {
      const scenes = await prisma.scene.findMany({
        where: { planVersionId: plan.id },
        orderBy: { idx: "asc" }
      });
      planPayload = planVersionToPayload(plan, scenes);
    }
  }
  res.json({ project, plan: planPayload });
});

projectRouter.post("/project/:id/plan", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const pack = await getNichePack(project.nichePackId);
  if (!pack) {
    res.status(400).json({ error: "Unknown niche pack." });
    return;
  }

  const settings = {
    topic: project.title,
    nichePackId: project.nichePackId,
    language: project.language,
    targetLengthSec: project.targetLengthSec,
    tempo: project.tempo as "slow" | "normal" | "fast",
    voicePreset: project.voicePreset,
    visualStylePreset: project.visualStylePreset
  };

  let planPayload;
  if (providerStatus.openaiConfigured) {
    planPayload = await buildPlanPayload(settings, pack);
  } else {
    planPayload = generateTemplatePlan(settings, pack);
  }

  const timings = computeSceneTimings(planPayload.scenes.map((scene) => scene.durationTargetSec));
  const planVersion = await prisma.planVersion.create({
    data: {
      projectId: project.id,
      hookOptionsJson: planPayload.hookOptions,
      hookSelected: planPayload.hookSelected,
      outline: planPayload.outline,
      scriptFull: planPayload.scriptFull,
      estimatesJson: planPayload.estimates,
      validationJson: planPayload.validation,
      scenes: {
        create: planPayload.scenes.map((scene, idx) => ({
          projectId: project.id,
          idx: scene.idx,
          narrationText: scene.narrationText,
          onScreenText: scene.onScreenText,
          visualPrompt: scene.visualPrompt,
          negativePrompt: scene.negativePrompt,
          effectPreset: scene.effectPreset as any,
          durationTargetSec: scene.durationTargetSec,
          startTimeSec: timings[idx]?.start ?? 0,
          endTimeSec: timings[idx]?.end ?? scene.durationTargetSec,
          isLocked: scene.lock
        }))
      }
    }
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      latestPlanVersionId: planVersion.id,
      status: "PLAN_READY"
    }
  });

  const scenes = await prisma.scene.findMany({
    where: { planVersionId: planVersion.id },
    orderBy: { idx: "asc" }
  });
  res.json({ planVersionId: planVersion.id, plan: planVersionToPayload(planVersion, scenes) });
});

projectRouter.get("/project/:id/runs", async (req, res) => {
  const runs = await prisma.run.findMany({
    where: { projectId: req.params.id },
    orderBy: { createdAt: "desc" }
  });
  res.json({ runs });
});

projectRouter.post("/project/:id/duplicate", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const topic = String(req.body?.topic ?? "").trim();
  if (!topic) {
    res.status(400).json({ error: "New topic is required for duplication." });
    return;
  }
  const newProject = await prisma.project.create({
    data: {
      title: topic,
      nichePackId: project.nichePackId,
      language: project.language,
      targetLengthSec: project.targetLengthSec,
      tempo: project.tempo,
      voicePreset: project.voicePreset,
      visualStylePreset: project.visualStylePreset,
      status: "PLAN_READY"
    }
  });
  if (!project.latestPlanVersionId) {
    res.json({ project: newProject, planVersionId: null });
    return;
  }
  const plan = await prisma.planVersion.findUnique({ where: { id: project.latestPlanVersionId } });
  if (!plan) {
    res.json({ project: newProject, planVersionId: null });
    return;
  }
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
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
        create: scenes.map((scene) => ({
          projectId: newProject.id,
          idx: scene.idx,
          narrationText: scene.narrationText,
          onScreenText: scene.onScreenText,
          visualPrompt: scene.visualPrompt,
          negativePrompt: scene.negativePrompt,
          effectPreset: scene.effectPreset,
          durationTargetSec: scene.durationTargetSec,
          startTimeSec: scene.startTimeSec,
          endTimeSec: scene.endTimeSec,
          isLocked: scene.isLocked
        }))
      }
    }
  });
  await prisma.project.update({
    where: { id: newProject.id },
    data: { latestPlanVersionId: newPlan.id }
  });
  res.json({ project: newProject, planVersionId: newPlan.id });
});

