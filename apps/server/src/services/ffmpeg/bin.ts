import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { spawnSync } from 'node:child_process';

export type FfmpegBinaries = {
  ffmpegPath: string | null;
  ffprobePath: string | null;
  source: 'static' | 'system' | 'none';
};

function isRunnable(cmd: string) {
  try {
    const r = spawnSync(cmd, ['-version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

export function detectFfmpeg(): FfmpegBinaries {
  const staticFfmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : null;
  const staticFfprobe = (ffprobeStatic as any)?.path ? String((ffprobeStatic as any).path) : null;

  if (staticFfmpeg && staticFfprobe && isRunnable(staticFfmpeg) && isRunnable(staticFfprobe)) {
    return { ffmpegPath: staticFfmpeg, ffprobePath: staticFfprobe, source: 'static' };
  }

  if (isRunnable('ffmpeg') && isRunnable('ffprobe')) {
    return { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe', source: 'system' };
  }

  return { ffmpegPath: null, ffprobePath: null, source: 'none' };
}

