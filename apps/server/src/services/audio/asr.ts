import fs from "fs/promises";
import { File } from "node:buffer";
import { getOpenAIClient } from "../providers/openaiClient.js";

export async function transcribeAudio(options: {
  audioPath: string;
  outputPath: string;
}) {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");
  const audio = await fs.readFile(options.audioPath);
  const response = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: new File([audio], "audio.wav", { type: "audio/wav" }),
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"]
  });
  await fs.writeFile(options.outputPath, JSON.stringify(response, null, 2), "utf8");
  return response;
}
