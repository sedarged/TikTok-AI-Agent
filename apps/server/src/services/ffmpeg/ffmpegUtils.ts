import { spawn } from 'child_process';
import { logError, logDebug } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import path from 'path';
import fs from 'fs';

let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

/** Run ffprobe with args (no shell); returns stdout. */
async function runFfprobe(args: string[], timeoutMs: number = 30000): Promise<string> {
  const ffprobe = await getFFprobePath();
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(ffprobe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffprobe timeout'));
    }, timeoutMs);
    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`ffprobe exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Escape path for FFmpeg concat list line: file 'path' — single quotes in path escaped. */
export function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

// Check if FFmpeg is available
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    const ffmpeg = await getFFmpegPath();
    return ffmpeg !== null;
  } catch {
    return false;
  }
}

// Run a command with args (no shell); rejects on non-zero exit or error.
function runCommand(cmd: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('timeout'));
    }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`exit ${code}`));
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Get FFmpeg path (prefer explicit env, fallback to system)
export async function getFFmpegPath(): Promise<string> {
  if (ffmpegPath) return ffmpegPath;

  const envFfmpegPath = process.env.FFMPEG_PATH;
  if (envFfmpegPath) {
    try {
      await runCommand(envFfmpegPath, ['-version'], 10000);
      ffmpegPath = envFfmpegPath;
      return ffmpegPath;
    } catch (error) {
      logError('FFMPEG_PATH is set but not usable', error);
      throw new Error('FFMPEG_PATH is set but ffmpeg could not be executed.');
    }
  }

  // Try system ffmpeg (spawn, no shell)
  try {
    await runCommand('ffmpeg', ['-version'], 10000);
    ffmpegPath = 'ffmpeg';
    return ffmpegPath;
  } catch (error) {
    logError('FFmpeg not found. Install system ffmpeg or set FFMPEG_PATH.', error);
    throw new Error('FFmpeg not found. Install system ffmpeg or set FFMPEG_PATH.');
  }
}

// Get FFprobe path
export async function getFFprobePath(): Promise<string> {
  if (ffprobePath) return ffprobePath;

  const envFfprobePath = process.env.FFPROBE_PATH;
  if (envFfprobePath) {
    try {
      await runCommand(envFfprobePath, ['-version'], 10000);
      ffprobePath = envFfprobePath;
      return ffprobePath;
    } catch (error) {
      logError('FFPROBE_PATH is set but not usable', error);
      throw new Error('FFPROBE_PATH is set but ffprobe could not be executed.');
    }
  }

  // Try system ffprobe first (spawn, no shell)
  try {
    await runCommand('ffprobe', ['-version'], 10000);
    ffprobePath = 'ffprobe';
    return ffprobePath;
  } catch (error) {
    logDebug('System ffprobe not found, checking alongside FFmpeg binary', { error });
    // Ensure ffmpegPath is resolved before checking for adjacent ffprobe
    try {
      await getFFmpegPath();
    } catch {
      // If ffmpeg is not available, we can't check for adjacent ffprobe
      throw new Error('FFprobe not found. Install system ffprobe or set FFPROBE_PATH.');
    }

    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      const candidate = path.join(path.dirname(ffmpegPath), 'ffprobe');
      if (fs.existsSync(candidate)) {
        try {
          await runCommand(candidate, ['-version'], 10000);
          ffprobePath = candidate;
          return ffprobePath;
        } catch (probeError) {
          logDebug(
            'Found ffprobe next to FFmpeg but failed version check (not executable or invalid binary)',
            {
              error: probeError,
              candidate,
            }
          );
        }
      }
    }
    throw new Error('FFprobe not found. Install system ffprobe or set FFPROBE_PATH.');
  }
}

// Run FFmpeg command
export async function runFFmpeg(args: string[]): Promise<void> {
  const ffmpeg = await getFFmpegPath();

  return new Promise((resolve, reject) => {
    logDebug(`Running: ${ffmpeg} ${args.join(' ')}`);

    const proc = spawn(ffmpeg, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Get media duration using ffprobe (spawn with args, no path interpolation)
export async function getMediaDuration(filePath: string): Promise<number> {
  const stdout = await runFfprobe(
    ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
    30000
  );
  const duration = parseFloat(stdout);
  if (isNaN(duration)) {
    throw new Error(`Could not get duration for ${filePath}`);
  }
  return duration;
}

// Validate video file (spawn with args, no path interpolation)
export async function validateVideo(videoPath: string): Promise<{
  valid: boolean;
  duration?: number;
  width?: number;
  height?: number;
  error?: string;
}> {
  if (!fs.existsSync(videoPath)) {
    return { valid: false, error: 'File does not exist' };
  }

  try {
    const stdout = await runFfprobe(
      [
        '-v',
        'quiet',
        '-show_entries',
        'format=duration:stream=width,height',
        '-of',
        'json',
        videoPath,
      ],
      30000
    );
    const data = safeJsonParse<{
      format?: { duration?: string };
      streams?: Array<{ width?: number; height?: number }>;
    }>(stdout, {});
    const duration = parseFloat(data.format?.duration || '0');
    const videoStream = data.streams?.find((s) => s.width && s.height);
    return {
      valid: duration > 0,
      duration,
      width: videoStream?.width,
      height: videoStream?.height,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

// Concatenate audio files (paths escaped for concat demuxer)
export async function concatenateAudio(inputFiles: string[], outputPath: string): Promise<void> {
  const listFile = outputPath + '.list.txt';
  const listContent = inputFiles.map((f) => `file '${escapeConcatPath(f)}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  try {
    await runFFmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', outputPath]);
  } finally {
    if (fs.existsSync(listFile)) {
      fs.unlinkSync(listFile);
    }
  }
}

// Create video from image with motion effect
export async function createSceneVideo(
  imagePath: string,
  duration: number,
  effect: string,
  outputPath: string
): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Get motion filter based on effect
  const filter = getMotionFilter(effect, duration);

  await runFFmpeg([
    '-loop',
    '1',
    '-i',
    imagePath,
    '-c:v',
    'libx264',
    '-t',
    duration.toString(),
    '-pix_fmt',
    'yuv420p',
    '-vf',
    filter,
    '-r',
    '30',
    '-y',
    outputPath,
  ]);
}

// Get FFmpeg filter for motion effect (exported for unit tests)
export function getMotionFilter(effect: string, duration: number): string {
  const scale = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

  switch (effect) {
    case 'slow_zoom_in':
      return `${scale},zoompan=z='min(zoom+0.0005,1.1)':d=${duration * 30}:s=1080x1920:fps=30`;

    case 'slow_zoom_out':
      return `${scale},zoompan=z='if(eq(on,1),1.1,max(zoom-0.0005,1))':d=${duration * 30}:s=1080x1920:fps=30`;

    case 'pan_left':
      return `${scale},zoompan=z='1.1':x='iw/2-(iw/zoom/2)+((iw/zoom)*(1-on/(${duration * 30})))':y='ih/2-(ih/zoom/2)':d=${duration * 30}:s=1080x1920:fps=30`;

    case 'pan_right':
      return `${scale},zoompan=z='1.1':x='iw/2-(iw/zoom/2)-((iw/zoom)*(1-on/(${duration * 30})))':y='ih/2-(ih/zoom/2)':d=${duration * 30}:s=1080x1920:fps=30`;

    case 'tilt_up':
      return `${scale},zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+((ih/zoom)*(1-on/(${duration * 30})))':d=${duration * 30}:s=1080x1920:fps=30`;

    case 'tilt_down':
      return `${scale},zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-((ih/zoom)*(1-on/(${duration * 30})))':d=${duration * 30}:s=1080x1920:fps=30`;

    case 'glitch':
      // Simulate glitch with random displacement
      return `${scale},noise=c0s=10:c0f=t+u`;

    case 'flash_cut':
      // Quick fade in
      return `${scale},fade=in:0:5`;

    case 'fade':
      return `${scale},fade=in:0:15,fade=out:${Math.floor(duration * 30 - 15)}:15`;

    case 'static':
    default:
      return scale;
  }
}

// Concatenate videos with transitions
export async function concatenateVideos(
  inputFiles: string[],
  outputPath: string,
  _transitionDuration: number = 0.2
): Promise<void> {
  if (inputFiles.length === 0) {
    throw new Error('No input files');
  }

  if (inputFiles.length === 1) {
    fs.copyFileSync(inputFiles[0], outputPath);
    return;
  }

  // Create concat file (paths escaped for concat demuxer)
  const listFile = outputPath + '.list.txt';
  const listContent = inputFiles.map((f) => `file '${escapeConcatPath(f)}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  try {
    await runFFmpeg([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'fast',
      '-pix_fmt',
      'yuv420p',
      '-y',
      outputPath,
    ]);
  } finally {
    if (fs.existsSync(listFile)) {
      fs.unlinkSync(listFile);
    }
  }
}

// Mix audio tracks (voice over + music)
export async function mixAudio(
  voicePath: string,
  musicPath: string | null,
  outputPath: string,
  musicVolume: number = 0.15
): Promise<void> {
  if (!musicPath || !fs.existsSync(musicPath)) {
    // No music, just copy voice
    fs.copyFileSync(voicePath, outputPath);
    return;
  }

  // Get voice duration
  const voDuration = await getMediaDuration(voicePath);

  // Mix with ducking
  await runFFmpeg([
    '-i',
    voicePath,
    '-i',
    musicPath,
    '-filter_complex',
    `[1:a]volume=${musicVolume},atrim=0:${voDuration}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2`,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-y',
    outputPath,
  ]);
}

// TikTok standard: 1080x1920, 30fps, keyframe every 1s, AAC 256k, loudnorm -14 LUFS
const TIKTOK_SCALE =
  'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2';

// Combine video with audio and captions (TikTok preset when outputting final MP4)
export async function finalComposite(
  videoPath: string,
  audioPath: string,
  captionsPath: string | null,
  outputPath: string
): Promise<void> {
  const filters: string[] = [TIKTOK_SCALE];
  if (captionsPath && fs.existsSync(captionsPath)) {
    filters.push(`subtitles='${captionsPath.replace(/'/g, "\\'")}'`);
  }

  await runFFmpeg([
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-vf',
    filters.join(','),
    '-c:v',
    'libx264',
    '-b:v',
    '12M',
    '-maxrate',
    '14M',
    '-bufsize',
    '24M',
    '-g',
    '30',
    '-r',
    '30',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-af',
    'loudnorm=I=-14:TP=-1:LRA=11',
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-shortest',
    '-y',
    outputPath,
  ]);
}

// Extract thumbnail
export async function extractThumbnail(
  videoPath: string,
  outputPath: string,
  timeOffset: number = 2
): Promise<void> {
  await runFFmpeg([
    '-i',
    videoPath,
    '-ss',
    timeOffset.toString(),
    '-vframes',
    '1',
    '-vf',
    'scale=540:960',
    '-y',
    outputPath,
  ]);
}
