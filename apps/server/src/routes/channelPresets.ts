import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { ROOT_DIR } from '../env.js';

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
  const fromRoot = path.join(ROOT_DIR, 'data', 'channel-presets.json');
  if (fs.existsSync(fromRoot)) return fromRoot;
  // Fallback for when ROOT_DIR is apps/server (shouldn't happen, but defensive)
  const fromServer = path.resolve(ROOT_DIR, '..', '..', 'data', 'channel-presets.json');
  if (fs.existsSync(fromServer)) return fromServer;
  return fromRoot;
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
