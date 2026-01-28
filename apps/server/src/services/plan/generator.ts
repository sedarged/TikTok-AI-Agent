import { Project, PrismaClient } from '@prisma/client';
import { PlanVersionPayload, SceneItem } from '../../types';
import { NICHE_PACKS } from './nichePacks';
import { isAIConfigured, chatCompletionJSON } from '../providers/openai';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function generatePlan(project: Project) {
  // If OpenAI is not configured, use a template generator (mock)
  if (!isAIConfigured()) {
    return generateTemplatePlan(project);
  }

  // Real AI Generation
  return generateAIPlan(project);
}

async function generateAIPlan(project: Project) {
  const pack = NICHE_PACKS[project.nichePackId] || NICHE_PACKS['facts'];

  // Step 1: Hooks
  const hooksPayload = await chatCompletionJSON<{ hooks: string[] }>(
    `You are a viral TikTok script writer. Generate 5 hook options for a video about "${project.title}" in the "${pack.label}" niche. Language: ${project.language}. Rules: ${pack.hookRules.join(', ')}. Return JSON: { "hooks": ["hook1", "hook2"...] }`,
    `Generate hooks for: ${project.title}`
  );
  
  const hooks = hooksPayload.hooks.slice(0, 5);
  const selectedHook = hooks[0];

  // Step 2: Outline & Scenes
  // We ask for scenes directly to save tokens/latency, or splitting as requested.
  // The user requested: A) Hooks -> B) Outline+Scenes -> C) FullScript
  
  const pacing = pack.scenePacing[project.targetLengthSec as 60|90|120|180] || pack.scenePacing[60];
  
  const systemPrompt = `
    You are an expert video director.
    Niche: ${pack.label}
    Topic: ${project.title}
    Hook: ${selectedHook}
    Target Duration: ${project.targetLengthSec}s
    Pacing: ${pacing.minScenes}-${pacing.maxScenes} scenes.
    Language: ${project.language}
    
    Style Bible: ${pack.styleBiblePrompt}
    Global Negative: ${pack.globalNegativePrompt}
    
    Effect Presets Allowed: ${pack.effectsProfile.allowed.join(', ')}
    
    Generate a JSON object with:
    1. "outline": A short summary of the video structure.
    2. "scenes": Array of objects { "narrationText", "onScreenText", "visualPrompt", "negativePrompt", "effectPreset", "durationTargetSec" }
    
    Constraints:
    - narrationText: Engaging script spoken by TTS.
    - onScreenText: Short text overlay (max 5 words).
    - visualPrompt: Detailed image generation prompt (no text in image).
    - negativePrompt: Specific negative prompt additions.
    - effectPreset: One of the allowed presets.
    - durationTargetSec: Approx duration for the scene. Sum must be close to ${project.targetLengthSec}.
  `;

  const sceneResult = await chatCompletionJSON<{ outline: string; scenes: any[] }>(
    systemPrompt,
    `Generate the full plan.`
  );

  // Post-process scenes
  let currentTime = 0;
  const scenes: SceneItem[] = sceneResult.scenes.map((s, idx) => {
    const scene: SceneItem = {
      id: uuidv4(),
      idx: idx + 1,
      narrationText: s.narrationText,
      onScreenText: s.onScreenText || '',
      visualPrompt: s.visualPrompt,
      negativePrompt: s.negativePrompt || '',
      effectPreset: s.effectPreset || pack.effectsProfile.default,
      durationTargetSec: Number(s.durationTargetSec),
      lock: false
    };
    currentTime += scene.durationTargetSec;
    return scene;
  });

  // Step 3: Script Full (concatenation of narration)
  const scriptFull = scenes.map(s => s.narrationText).join(' ');
  const wpm = 150; // Average speaking rate
  const wordCount = scriptFull.split(/\s+/).length;
  const estimatedLengthSec = Math.ceil(wordCount / (wpm / 60));

  const planPayload: PlanVersionPayload = {
    hookOptions: hooks,
    hookSelected: selectedHook,
    outline: sceneResult.outline,
    scriptFull,
    scenes,
    estimates: {
      wpm,
      estimatedLengthSec,
      targetLengthSec: project.targetLengthSec
    },
    validation: {
      errors: [],
      warnings: [],
      suggestions: []
    }
  };

  return savePlanVersion(project.id, planPayload);
}

async function generateTemplatePlan(project: Project) {
  const pack = NICHE_PACKS[project.nichePackId] || NICHE_PACKS['facts'];
  const pacing = pack.scenePacing[project.targetLengthSec as 60|90|120|180] || pack.scenePacing[60];
  
  // Deterministic mock generation
  const scenesCount = Math.floor((pacing.minScenes + pacing.maxScenes) / 2);
  const durationPerScene = project.targetLengthSec / scenesCount;
  
  const hooks = [
    `Unbelievable facts about ${project.title}`,
    `You won't believe this about ${project.title}`,
    `The secret of ${project.title} revealed`,
    `Why ${project.title} is amazing`,
    `Top secrets of ${project.title}`
  ];

  const scenes: SceneItem[] = Array.from({ length: scenesCount }).map((_, i) => ({
    id: uuidv4(),
    idx: i + 1,
    narrationText: `This is scene number ${i + 1} about ${project.title}. It is very interesting.`,
    onScreenText: `Fact #${i + 1}`,
    visualPrompt: `A beautiful image representing ${project.title} part ${i + 1}, ${pack.styleBiblePrompt}`,
    negativePrompt: pack.globalNegativePrompt,
    effectPreset: pack.effectsProfile.default,
    durationTargetSec: Number(durationPerScene.toFixed(1)),
    lock: false
  }));

  const planPayload: PlanVersionPayload = {
    hookOptions: hooks,
    hookSelected: hooks[0],
    outline: `A structured overview of ${project.title} covering key points 1 to ${scenesCount}.`,
    scriptFull: scenes.map(s => s.narrationText).join(' '),
    scenes,
    estimates: {
      wpm: 150,
      estimatedLengthSec: project.targetLengthSec,
      targetLengthSec: project.targetLengthSec
    },
    validation: {
      errors: [],
      warnings: ["Template mode: AI not configured"],
      suggestions: ["Configure OPENAI_API_KEY for real generation"]
    }
  };

  return savePlanVersion(project.id, planPayload);
}

async function savePlanVersion(projectId: string, payload: PlanVersionPayload) {
  // Save to DB
  const planVersion = await prisma.planVersion.create({
    data: {
      projectId,
      hookOptionsJson: JSON.stringify(payload.hookOptions),
      hookSelected: payload.hookSelected,
      outline: payload.outline,
      scriptFull: payload.scriptFull,
      estimatesJson: JSON.stringify(payload.estimates),
      validationJson: JSON.stringify(payload.validation),
    }
  });

  // Create scenes in DB
  await prisma.scene.createMany({
    data: payload.scenes.map(s => ({
      projectId,
      planVersionId: planVersion.id,
      idx: s.idx,
      narrationText: s.narrationText,
      onScreenText: s.onScreenText,
      visualPrompt: s.visualPrompt,
      negativePrompt: s.negativePrompt,
      effectPreset: s.effectPreset,
      durationTargetSec: s.durationTargetSec,
      isLocked: s.lock
    }))
  });

  // Update project
  await prisma.project.update({
    where: { id: projectId },
    data: { 
      status: 'PLAN_READY',
      latestPlanVersionId: planVersion.id
    }
  });

  return {
    ...planVersion,
    scenes: payload.scenes
  };
}
