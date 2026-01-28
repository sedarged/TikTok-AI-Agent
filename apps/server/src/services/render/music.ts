import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../env.js';
import { runCmd } from '../ffmpeg/run.js';
import { ffprobeJson } from '../ffmpeg/probe.js';

const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];

export async function buildMusicBed(args: { ffmpegPath: string; ffprobePath: string; voPath: string; outPath: string }) {
  const musicDir = path.resolve(env.MUSIC_LIBRARY_DIR);
  if (!fs.existsSync(musicDir)) return { used: false, reason: `MUSIC_LIBRARY_DIR not found: ${musicDir}` };

  const files = fs
    .readdirSync(musicDir)
    .filter((f) => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
    .map((f) => path.join(musicDir, f))
    .sort();

  if (files.length === 0) return { used: false, reason: `No audio files found in MUSIC_LIBRARY_DIR: ${musicDir}` };

  const musicPath = files[0];
  const probe = await ffprobeJson({ ffprobePath: args.ffprobePath, inputPath: args.voPath });
  const dur = Number(probe?.format?.duration ?? 0);
  if (!Number.isFinite(dur) || dur <= 0) return { used: false, reason: 'Could not determine VO duration for music bed.' };

  // Loop music to VO duration and output wav.
  await runCmd(args.ffmpegPath, [
    '-y',
    '-stream_loop',
    '-1',
    '-i',
    musicPath,
    '-t',
    String(dur),
    '-vn',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s16le',
    args.outPath
  ]);

  return { used: true, reason: null, musicPath };
}

