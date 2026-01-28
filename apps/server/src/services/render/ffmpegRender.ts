import fs from 'node:fs';
import path from 'node:path';
import { runCmd } from '../ffmpeg/run.js';

export async function renderSceneSegment(args: {
  ffmpegPath: string;
  imagePath: string;
  outPath: string;
  durationSec: number;
  effectPreset: string;
}) {
  const dur = Math.max(0.5, args.durationSec);
  const frames = Math.round(dur * 30);
  const vf = buildEffectFilter(args.effectPreset, dur, frames);

  await runCmd(args.ffmpegPath, [
    '-y',
    '-loop',
    '1',
    '-t',
    String(dur),
    '-i',
    args.imagePath,
    '-vf',
    `${baseOverscan()},${vf},fps=30,format=yuv420p`,
    '-r',
    '30',
    '-t',
    String(dur),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    args.outPath
  ]);
}

export async function concatSegments(args: { ffmpegPath: string; segmentPaths: string[]; concatListPath: string; outPath: string }) {
  const lines = args.segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(args.concatListPath, lines);
  await runCmd(args.ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', args.concatListPath, '-c', 'copy', args.outPath]);
}

export async function renderFinalMp4(args: {
  ffmpegPath: string;
  inputVideoPath: string;
  voAudioPath: string;
  musicPath?: string | null;
  captionsAssPath: string;
  outMp4Path: string;
}) {
  const hasMusic = Boolean(args.musicPath);

  const filterComplex = hasMusic
    ? [
        `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[vo];`,
        `[2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.22[bg];`,
        `[bg][vo]sidechaincompress=threshold=0.08:ratio=10:attack=5:release=200[ducked];`,
        `[vo][ducked]amix=inputs=2:duration=first:dropout_transition=2[aout]`
      ].join('')
    : `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[aout]`;

  const argsList = [
    '-y',
    '-i',
    args.inputVideoPath,
    '-i',
    args.voAudioPath
  ];
  if (hasMusic) argsList.push('-i', args.musicPath as string);

  argsList.push(
    '-filter_complex',
    filterComplex,
    '-map',
    '0:v:0',
    '-map',
    '[aout]',
    '-vf',
    `ass=${escapeFilterPath(args.captionsAssPath)},format=yuv420p`,
    '-c:v',
    'libx264',
    '-r',
    '30',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    args.outMp4Path
  );

  await runCmd(args.ffmpegPath, argsList);
}

export async function extractThumbnail(args: { ffmpegPath: string; mp4Path: string; outPngPath: string; atSec: number }) {
  await runCmd(args.ffmpegPath, ['-y', '-ss', String(Math.max(0, args.atSec)), '-i', args.mp4Path, '-vframes', '1', args.outPngPath]);
}

function baseScaleCrop() {
  return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
}

function baseOverscan() {
  // Overscan gives room for pan/tilt without black borders.
  return 'scale=ceil(1080*1.2):ceil(1920*1.2):force_original_aspect_ratio=increase,crop=ceil(1080*1.2):ceil(1920*1.2)';
}

function buildEffectFilter(effect: string, dur: number, frames: number) {
  const D = dur.toFixed(3);
  switch (effect) {
    case 'slow_zoom_out':
      return `zoompan=z='if(lte(on,1),1.12,max(1.00,zoom-0.0010))':d=${frames}:s=1080x1920:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    case 'pan_left':
      return `crop=1080:1920:x='(in_w-1080)*(1-t/${D})':y='(in_h-1920)/2'`;
    case 'pan_right':
      return `crop=1080:1920:x='(in_w-1080)*(t/${D})':y='(in_h-1920)/2'`;
    case 'tilt_up':
      return `crop=1080:1920:x='(in_w-1080)/2':y='(in_h-1920)*(1-t/${D})'`;
    case 'tilt_down':
      return `crop=1080:1920:x='(in_w-1080)/2':y='(in_h-1920)*(t/${D})'`;
    case 'flash_cut':
      return `eq=brightness='if(lt(t,0.08),0.25,0)':contrast=1.05,fade=t=in:st=0:d=0.08`;
    case 'fade':
      return `fade=t=in:st=0:d=0.18,fade=t=out:st=${Math.max(0, dur - 0.18).toFixed(3)}:d=0.18`;
    case 'glitch':
      return `noise=alls=18:allf=t+u,eq=contrast=1.10:saturation=1.2`;
    case 'slow_zoom_in':
    default:
      return `zoompan=z='min(1.14,zoom+0.0010)':d=${frames}:s=1080x1920:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
  }
}

function escapeFilterPath(p: string) {
  // ffmpeg filter args need escaping ':' and '\' on Windows; here we just escape ':' for safety.
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

