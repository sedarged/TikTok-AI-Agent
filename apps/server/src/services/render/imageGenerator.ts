import fs from "fs/promises";
import path from "path";
import { prisma } from "../../db/client.js";
import { getOpenAIClient } from "../providers/openaiClient.js";
import { hashString } from "../../utils/hash.js";

export async function generateImageCached(options: {
  prompt: string;
  outputPath: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
}) {
  const size = options.size ?? "1024x1792";
  const hashKey = hashString(`${size}:${options.prompt}`);
  const cached = await prisma.cache.findUnique({ where: { hashKey } });
  if (cached?.payloadPath) {
    try {
      await fs.access(cached.payloadPath);
      await fs.copyFile(cached.payloadPath, options.outputPath);
      return;
    } catch {
      // fallthrough to regenerate
    }
  }

  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI is not configured.");
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt: options.prompt,
    size,
    response_format: "b64_json"
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation failed.");
  const buffer = Buffer.from(b64, "base64");
  await fs.writeFile(options.outputPath, buffer);

  const payloadPath = path.join(path.dirname(options.outputPath), `${hashKey}.png`);
  await fs.writeFile(payloadPath, buffer);
  await prisma.cache.upsert({
    where: { hashKey },
    create: {
      kind: "images",
      hashKey,
      resultJson: { size },
      payloadPath
    },
    update: {
      payloadPath,
      resultJson: { size }
    }
  });
}
