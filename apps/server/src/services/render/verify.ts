import fs from 'node:fs';
import path from 'node:path';
import { detectFfmpeg } from '../ffmpeg/bin.js';
import { ffprobeJson } from '../ffmpeg/probe.js';

export async function verifyRunArtifacts(args: {
  expectedTargetLengthSec: number;
  voFullPath: string;
  captionsAssPath: string;
  mp4Path: string;
  thumbPath: string;
  exportJsonPath: string;
  imagesDir: string;
}) {
  const issues: string[] = [];

  const requiredFiles = [
    { label: 'vo_full.wav', p: args.voFullPath },
    { label: 'captions.ass', p: args.captionsAssPath },
    { label: 'final.mp4', p: args.mp4Path },
    { label: 'thumb.png', p: args.thumbPath },
    { label: 'export.json', p: args.exportJsonPath }
  ];

  for (const f of requiredFiles) {
    if (!existsFile(f.p)) issues.push(`Missing required file: ${f.label} (${f.p})`);
  }

  if (!fs.existsSync(args.imagesDir)) {
    issues.push(`Missing imagesDir: ${args.imagesDir}`);
  } else {
    const pngs = fs.readdirSync(args.imagesDir).filter((x) => x.toLowerCase().endsWith('.png'));
    if (pngs.length === 0) issues.push(`No scene images found in ${args.imagesDir}`);
  }

  const ff = detectFfmpeg();
  if (!ff.ffprobePath) {
    issues.push('ffprobe not available; cannot validate MP4 streams/duration.');
  } else if (existsFile(args.mp4Path)) {
    try {
      const probe = await ffprobeJson({ ffprobePath: ff.ffprobePath, inputPath: args.mp4Path });
      const dur = Number(probe?.format?.duration ?? 0);
      if (!Number.isFinite(dur) || dur <= 0) issues.push('final.mp4 duration is invalid (ffprobe).');
      const hasVideo = (probe?.streams ?? []).some((s: any) => s.codec_type === 'video');
      const hasAudio = (probe?.streams ?? []).some((s: any) => s.codec_type === 'audio');
      if (!hasVideo) issues.push('final.mp4 has no video stream.');
      if (!hasAudio) issues.push('final.mp4 has no audio stream.');

      const tolerance = args.expectedTargetLengthSec >= 180 ? 5 : 3;
      if (Number.isFinite(dur) && Math.abs(dur - args.expectedTargetLengthSec) > tolerance) {
        issues.push(`Duration mismatch: mp4=${dur.toFixed(2)}s vs target=${args.expectedTargetLengthSec}s (tolerance ±${tolerance}s).`);
      }
    } catch (e: any) {
      issues.push(`ffprobe failed: ${String(e?.message || e)}`);
    }
  }

  return { pass: issues.length === 0, issues };
}

function existsFile(p: string) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

