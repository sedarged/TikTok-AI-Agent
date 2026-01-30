import { Router } from 'express';
import path from 'path';
import fs from 'fs';

export interface ChannelPreset {
  id: string;
  name: string;
  nichePackId: string;
  voicePreset: string;
  targetLengthSec: number;
  tempo: string;
  language?: string;
}

function getPresetsPath(): string {
  const fromCwd = path.join(process.cwd(), 'data', 'channel-presets.json');
  if (fs.existsSync(fromCwd)) return fromCwd;
  const fromServer = path.resolve(process.cwd(), '..', '..', 'data', 'channel-presets.json');
  if (fs.existsSync(fromServer)) return fromServer;
  return fromCwd;
}

export const channelPresetsRoutes = Router();

channelPresetsRoutes.get('/', (_req, res) => {
  try {
    const filePath = getPresetsPath();
    if (!fs.existsSync(filePath)) {
      return res.json([]);
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const presets = JSON.parse(raw) as ChannelPreset[];
    if (!Array.isArray(presets)) {
      return res.json([]);
    }
    res.json(presets);
  } catch {
    res.json([]);
  }
});
