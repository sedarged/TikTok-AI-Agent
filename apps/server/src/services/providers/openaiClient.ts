import OpenAI from "openai";
import { config } from "../../env.js";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!config.openAiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openAiKey });
  }
  return client;
}
