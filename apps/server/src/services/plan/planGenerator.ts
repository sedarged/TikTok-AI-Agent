import { v4 as uuid } from "uuid";
import { getOpenAIClient } from "../providers/openaiClient.js";
import { extractJson } from "../../utils/json.js";
import { countWords } from "../../utils/text.js";
import { ProjectSettings, PlanVersionPayload, ScenePayload } from "./types.js";
import { NichePack } from "./nichePacks.js";
import { validatePlan } from "./validation.js";
import { autoFitDurations } from "./autofit.js";

const MODEL = "gpt-4o-mini";

const tempoWpm: Record<ProjectSettings["tempo"], number> = {
  slow: 130,
  normal: 155,
  fast: 180
};

function pacingForTarget(pack: NichePack, targetLengthSec: number) {
  const key =
    targetLengthSec >= 180 ? "180" : targetLengthSec >= 120 ? "120" : targetLengthSec >= 90 ? "90" : "60";
  return pack.scenePacing[key];
}

export async function generateHooks(
  settings: ProjectSettings,
  pack: NichePack
): Promise<string[]> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");

  const prompt = {
    topic: settings.topic,
    language: settings.language,
    nichePack: pack.name,
    hookRules: pack.hookRules
  };

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You create TikTok hooks. Respond ONLY with JSON. No markdown, no extra text."
      },
      {
        role: "user",
        content: `Generate 5 unique hook options as JSON: {"hookOptions":["..."]}. Avoid brand names or copyrighted references. Payload: ${JSON.stringify(
          prompt
        )}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ hookOptions: string[] }>(content);
  if (!Array.isArray(parsed.hookOptions) || parsed.hookOptions.length < 5) {
    throw new Error("Hook generation failed to return 5 options.");
  }
  return parsed.hookOptions.slice(0, 5);
}

export async function generateOutlineAndScenes(
  settings: ProjectSettings,
  pack: NichePack,
  hookSelected: string
): Promise<{ outline: string; scenes: ScenePayload[] }> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");

  const pacing = pacingForTarget(pack, settings.targetLengthSec);
  const payload = {
    topic: settings.topic,
    hookSelected,
    language: settings.language,
    targetLengthSec: settings.targetLengthSec,
    tempo: settings.tempo,
    sceneCountRange: {
      min: pacing.minScenes,
      max: pacing.maxScenes
    },
    allowedEffects: pack.effectsProfile.allowedEffects,
    styleBiblePrompt: pack.styleBiblePrompt,
    globalNegativePrompt: pack.globalNegativePrompt,
    visualStylePreset: settings.visualStylePreset
  };

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You generate outlines and scene plans for TikTok videos. Respond ONLY with JSON."
      },
      {
        role: "user",
        content:
          `Generate JSON with shape: {"outline":"...","scenes":[{"narrationText":"","onScreenText":"","visualPrompt":"","negativePrompt":"","effectPreset":"slow_zoom_in","durationTargetSec":7}]}. ` +
          `Scene count must be between ${pacing.minScenes} and ${pacing.maxScenes}. Durations should sum near target. Avoid brands and copyrighted references. Payload: ${JSON.stringify(
            payload
          )}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{
    outline: string;
    scenes: Omit<ScenePayload, "id" | "idx" | "lock">[];
  }>(content);
  if (!parsed?.scenes?.length) {
    throw new Error("Outline/scene generation failed.");
  }

  const scenes = parsed.scenes.map((scene, idx) => ({
    id: uuid(),
    idx,
    narrationText: scene.narrationText,
    onScreenText: scene.onScreenText,
    visualPrompt: scene.visualPrompt,
    negativePrompt: scene.negativePrompt ?? "",
    effectPreset: scene.effectPreset ?? pack.effectsProfile.defaultEffect,
    durationTargetSec: Number(scene.durationTargetSec),
    lock: false
  }));

  return { outline: parsed.outline, scenes };
}

export async function generateFullScriptFromScenes(
  settings: ProjectSettings,
  scenes: ScenePayload[],
  outline: string,
  hookSelected: string
): Promise<{ scriptFull: string; refinedScenes: ScenePayload[] }> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");

  const payload = {
    language: settings.language,
    targetLengthSec: settings.targetLengthSec,
    hookSelected,
    outline,
    scenes: scenes.map((scene) => ({
      idx: scene.idx,
      narrationText: scene.narrationText
    }))
  };

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write TikTok scripts. Respond ONLY with JSON."
      },
      {
        role: "user",
        content:
          `Return JSON: {"scriptFull":"...","scenes":[{"idx":0,"narrationText":"..."}]}. ` +
          `Keep narration concise and aligned to target length. Avoid brand names. Payload: ${JSON.stringify(
            payload
          )}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ scriptFull: string; scenes: { idx: number; narrationText: string }[] }>(
    content
  );
  if (!parsed?.scriptFull) {
    throw new Error("Script generation failed.");
  }
  const sceneMap = new Map(parsed.scenes.map((scene) => [scene.idx, scene.narrationText]));
  const refinedScenes = scenes.map((scene) => ({
    ...scene,
    narrationText: sceneMap.get(scene.idx) ?? scene.narrationText
  }));

  return { scriptFull: parsed.scriptFull, refinedScenes };
}

export async function regenerateOutline(
  settings: ProjectSettings,
  pack: NichePack,
  hookSelected: string,
  scenes: ScenePayload[]
): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");
  const payload = {
    topic: settings.topic,
    language: settings.language,
    hookSelected,
    scenes: scenes.map((scene) => ({ idx: scene.idx, narrationText: scene.narrationText }))
  };

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Regenerate an outline. Respond ONLY with JSON."
      },
      {
        role: "user",
        content: `Return JSON: {"outline":"..."}. Use pack style: ${pack.name}. Payload: ${JSON.stringify(
          payload
        )}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{ outline: string }>(content);
  if (!parsed.outline) throw new Error("Outline regeneration failed.");
  return parsed.outline;
}

export async function regenerateScript(
  settings: ProjectSettings,
  scenes: ScenePayload[],
  outline: string,
  hookSelected: string
): Promise<{ scriptFull: string; scenes: ScenePayload[] }> {
  const result = await generateFullScriptFromScenes(settings, scenes, outline, hookSelected);
  return { scriptFull: result.scriptFull, scenes: result.refinedScenes };
}

export async function buildPlanPayload(
  settings: ProjectSettings,
  pack: NichePack,
  hookSelectedOverride?: string
): Promise<PlanVersionPayload> {
  const hookOptions = await generateHooks(settings, pack);
  const hookSelected = hookSelectedOverride ?? hookOptions[0];
  const { outline, scenes } = await generateOutlineAndScenes(settings, pack, hookSelected);
  const { scriptFull, refinedScenes } = await generateFullScriptFromScenes(
    settings,
    scenes,
    outline,
    hookSelected
  );

  const wpm = tempoWpm[settings.tempo];
  const estimatedLengthSec = Math.max(5, Math.round((countWords(scriptFull) / wpm) * 60));

  let plan: PlanVersionPayload = {
    hookOptions,
    hookSelected,
    outline,
    scriptFull,
    scenes: refinedScenes,
    estimates: {
      wpm,
      estimatedLengthSec,
      targetLengthSec: settings.targetLengthSec
    },
    validation: {
      errors: [],
      warnings: [],
      suggestions: []
    }
  };

  plan = autoFitDurations(plan, pack);
  plan.validation = validatePlan(pack, plan);
  return plan;
}
