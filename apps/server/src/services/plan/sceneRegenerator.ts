import { getOpenAIClient } from "../providers/openaiClient.js";
import { extractJson } from "../../utils/json.js";
import { NichePack } from "./nichePacks.js";
import { ScenePayload, ProjectSettings } from "./types.js";

const MODEL = "gpt-4o-mini";

export async function regenerateScene(
  settings: ProjectSettings,
  pack: NichePack,
  targetScene: ScenePayload,
  neighbors: ScenePayload[]
): Promise<ScenePayload> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");

  const payload = {
    topic: settings.topic,
    language: settings.language,
    styleBiblePrompt: pack.styleBiblePrompt,
    globalNegativePrompt: pack.globalNegativePrompt,
    targetScene: {
      idx: targetScene.idx,
      durationTargetSec: targetScene.durationTargetSec,
      effectPreset: targetScene.effectPreset
    },
    neighborScenes: neighbors.map((scene) => ({
      idx: scene.idx,
      narrationText: scene.narrationText,
      visualPrompt: scene.visualPrompt
    }))
  };

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Regenerate a single scene. Respond ONLY with JSON."
      },
      {
        role: "user",
        content:
          `Return JSON: {"narrationText":"","onScreenText":"","visualPrompt":"","negativePrompt":"","effectPreset":"slow_zoom_in","durationTargetSec":7}. ` +
          `Keep style consistent with neighbors. Avoid brand names. Payload: ${JSON.stringify(
            payload
          )}`
      }
    ]
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson<{
    narrationText: string;
    onScreenText: string;
    visualPrompt: string;
    negativePrompt: string;
    effectPreset: ScenePayload["effectPreset"];
    durationTargetSec: number;
  }>(content);

  return {
    ...targetScene,
    narrationText: parsed.narrationText ?? targetScene.narrationText,
    onScreenText: parsed.onScreenText ?? targetScene.onScreenText,
    visualPrompt: parsed.visualPrompt ?? targetScene.visualPrompt,
    negativePrompt: parsed.negativePrompt ?? targetScene.negativePrompt,
    effectPreset: parsed.effectPreset ?? targetScene.effectPreset,
    durationTargetSec: Number(parsed.durationTargetSec || targetScene.durationTargetSec)
  };
}
