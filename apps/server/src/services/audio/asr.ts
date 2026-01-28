import fs from 'node:fs';
import type OpenAI from 'openai';

export async function transcribeWhisperVerbose(args: { client: OpenAI; audioPath: string; outJsonPath: string }) {
  const file = fs.createReadStream(args.audioPath);
  const resp = await args.client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment']
  } as any);
  fs.writeFileSync(args.outJsonPath, JSON.stringify(resp, null, 2));
  return resp as any;
}

