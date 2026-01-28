import fs from "fs/promises";
import path from "path";
import { getOpenAIClient } from "../providers/openaiClient.js";
import { config } from "../../env.js";

export async function generateTtsOpenAI(options: {
  text: string;
  voice: string;
  outputPath: string;
}) {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");
  const response = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: options.voice || "alloy",
    input: options.text,
    format: "wav"
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(options.outputPath, buffer);
}

export async function generateTtsElevenLabs(options: {
  text: string;
  voice: string;
  outputPath: string;
}) {
  if (!config.elevenLabsKey) throw new Error("ElevenLabs is not configured.");
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${options.voice}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": config.elevenLabsKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: options.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.7 }
    })
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(options.outputPath, Buffer.from(arrayBuffer));
}

export async function generateTts(options: {
  text: string;
  voicePreset: string;
  outputPath: string;
}) {
  const voicePreset = options.voicePreset || "alloy";
  if (voicePreset.startsWith("elevenlabs:")) {
    const voiceId = voicePreset.replace("elevenlabs:", "").trim();
    await generateTtsElevenLabs({
      text: options.text,
      voice: voiceId,
      outputPath: options.outputPath
    });
    return;
  }
  await generateTtsOpenAI({
    text: options.text,
    voice: voicePreset,
    outputPath: options.outputPath
  });
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function sceneAudioPath(audioDir: string, idx: number, ext = "wav") {
  return path.join(audioDir, `scene_${String(idx + 1).padStart(2, "0")}.${ext}`);
}
