import path from 'node:path';
import fs from 'node:fs';
import { env } from '../../env.js';

export type RunArtifacts = {
  rootDir: string;
  imagesDir: string;
  audioDir: string;
  captionsDir: string;
  finalDir: string;
  captionsAssPath: string;
  timestampsPath: string;
  voFullPath: string;
  mp4Path: string;
  thumbPath: string;
  exportJsonPath: string;
  concatListPath: string;
};

export function getRunArtifacts(projectId: string, runId: string): RunArtifacts {
  const rootDir = path.resolve(env.ARTIFACTS_DIR, projectId, runId);
  const imagesDir = path.join(rootDir, 'images');
  const audioDir = path.join(rootDir, 'audio');
  const captionsDir = path.join(rootDir, 'captions');
  const finalDir = path.join(rootDir, 'final');

  return {
    rootDir,
    imagesDir,
    audioDir,
    captionsDir,
    finalDir,
    captionsAssPath: path.join(captionsDir, 'captions.ass'),
    timestampsPath: path.join(captionsDir, 'timestamps.json'),
    voFullPath: path.join(audioDir, 'vo_full.wav'),
    mp4Path: path.join(finalDir, 'final.mp4'),
    thumbPath: path.join(finalDir, 'thumb.png'),
    exportJsonPath: path.join(finalDir, 'export.json'),
    concatListPath: path.join(finalDir, 'concat.txt')
  };
}

export function ensureArtifactsDirs(a: RunArtifacts) {
  for (const d of [a.rootDir, a.imagesDir, a.audioDir, a.captionsDir, a.finalDir]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

