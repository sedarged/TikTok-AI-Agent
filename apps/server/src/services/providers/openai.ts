import OpenAI from 'openai';
import { env } from '../../env';
import fs from 'fs';
import path from 'path';

let openai: OpenAI | null = null;

if (env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

export const getOpenAI = () => openai;
export const isAIConfigured = () => !!openai;

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'gpt-4o'
): Promise<string | null> {
  if (!openai) throw new Error('OpenAI not configured');
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

export async function chatCompletionJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'gpt-4o'
): Promise<T> {
  if (!openai) throw new Error('OpenAI not configured');
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('OpenAI JSON Error:', error);
    throw error;
  }
}

export async function generateImage(prompt: string, outputPath: string): Promise<void> {
    if (!openai) throw new Error('OpenAI not configured');
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1792", // Vertical format
            response_format: "b64_json"
        });
        
        const b64 = response.data[0].b64_json;
        if (b64) {
            await fs.promises.writeFile(outputPath, Buffer.from(b64, 'base64'));
        }
    } catch (error) {
        console.error('OpenAI Image Error:', error);
        throw error;
    }
}

export async function generateSpeech(text: string, voice: string, outputPath: string): Promise<void> {
    if (!openai) throw new Error('OpenAI not configured');
    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice as any || "alloy",
            input: text,
        });
        
        const buffer = Buffer.from(await mp3.arrayBuffer());
        await fs.promises.writeFile(outputPath, buffer);
    } catch (error) {
        console.error('OpenAI TTS Error:', error);
        throw error;
    }
}

export async function transcribeAudio(audioPath: string): Promise<any> {
    if (!openai) throw new Error('OpenAI not configured');
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"]
        });
        
        return transcription;
    } catch (error) {
        console.error('OpenAI Whisper Error:', error);
        throw error;
    }
}
