import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

let ffmpegPath: string | null = null;
let ffprobePath: string | null = null;

// Check if FFmpeg is available
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    const ffmpeg = await getFFmpegPath();
    return ffmpeg !== null;
  } catch {
    return false;
  }
}

// Get FFmpeg path (prefer ffmpeg-static, fallback to system)
export async function getFFmpegPath(): Promise<string> {
  if (ffmpegPath) return ffmpegPath;

  // Try ffmpeg-static first
  try {
    const ffmpegStaticModule = await import('ffmpeg-static');
    const ffmpegStaticPath = ffmpegStaticModule.default as unknown as string;
    if (ffmpegStaticPath && typeof ffmpegStaticPath === 'string' && fs.existsSync(ffmpegStaticPath)) {
      ffmpegPath = ffmpegStaticPath;
      return ffmpegPath;
    }
  } catch {
    // ffmpeg-static not installed
  }

  // Try system ffmpeg
  try {
    await execAsync('ffmpeg -version');
    ffmpegPath = 'ffmpeg';
    return ffmpegPath;
  } catch {
    throw new Error('FFmpeg not found. Install ffmpeg-static or system ffmpeg.');
  }
}

// Get FFprobe path
export async function getFFprobePath(): Promise<string> {
  if (ffprobePath) return ffprobePath;

  // Try system ffprobe first (works with ffmpeg-static too usually)
  try {
    await execAsync('ffprobe -version');
    ffprobePath = 'ffprobe';
    return ffprobePath;
  } catch {
    // If ffmpeg-static is installed, ffprobe might be in same dir
    try {
      const ffmpegStaticModule = await import('ffmpeg-static');
      const ffmpegStaticPath = ffmpegStaticModule.default as unknown as string;
      if (ffmpegStaticPath && typeof ffmpegStaticPath === 'string') {
        const ffprobeStatic = ffmpegStaticPath.replace('ffmpeg', 'ffprobe');
        if (fs.existsSync(ffprobeStatic)) {
          ffprobePath = ffprobeStatic;
          return ffprobePath;
        }
      }
    } catch {
      // not available
    }
    throw new Error('FFprobe not found');
  }
}

// Run FFmpeg command
export async function runFFmpeg(args: string[]): Promise<void> {
  const ffmpeg = await getFFmpegPath();
  
  return new Promise((resolve, reject) => {
    console.log(`Running: ${ffmpeg} ${args.join(' ')}`);
    
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

// Get media duration using ffprobe
export async function getMediaDuration(filePath: string): Promise<number> {
  const ffprobe = await getFFprobePath();
  
  const { stdout } = await execAsync(
    `${ffprobe} -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`
  );
  
  const duration = parseFloat(stdout.trim());
  if (isNaN(duration)) {
    throw new Error(`Could not get duration for ${filePath}`);
  }
  
  return duration;
}

// Validate video file
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
    const ffprobe = await getFFprobePath();
    
    const { stdout } = await execAsync(
      `${ffprobe} -v quiet -show_entries format=duration:stream=width,height -of json "${videoPath}"`
    );
    
    const data = JSON.parse(stdout);
    const duration = parseFloat(data.format?.duration || '0');
    const videoStream = data.streams?.find((s: { width?: number; height?: number }) => s.width && s.height);
    
    return {
      valid: duration > 0,
      duration,
      width: videoStream?.width,
      height: videoStream?.height,
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

// Concatenate audio files
export async function concatenateAudio(
  inputFiles: string[],
  outputPath: string
): Promise<void> {
  const listFile = outputPath + '.list.txt';
  const listContent = inputFiles.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  try {
    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      '-y',
      outputPath,
    ]);
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
    '-loop', '1',
    '-i', imagePath,
    '-c:v', 'libx264',
    '-t', duration.toString(),
    '-pix_fmt', 'yuv420p',
    '-vf', filter,
    '-r', '30',
    '-y',
    outputPath,
  ]);
}

// Get FFmpeg filter for motion effect
function getMotionFilter(effect: string, duration: number): string {
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
      return `${scale},fade=in:0:15,fade=out:${Math.floor((duration * 30) - 15)}:15`;
    
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

  // Create concat file
  const listFile = outputPath + '.list.txt';
  const listContent = inputFiles.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(listFile, listContent);

  try {
    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
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
    '-i', voicePath,
    '-i', musicPath,
    '-filter_complex', 
    `[1:a]volume=${musicVolume},atrim=0:${voDuration}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2`,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-y',
    outputPath,
  ]);
}

// Combine video with audio and captions
export async function finalComposite(
  videoPath: string,
  audioPath: string,
  captionsPath: string | null,
  outputPath: string
): Promise<void> {
  const filters: string[] = [];
  
  if (captionsPath && fs.existsSync(captionsPath)) {
    // Burn in subtitles
    filters.push(`subtitles='${captionsPath.replace(/'/g, "\\'")}'`);
  }

  const filterArg = filters.length > 0 ? ['-vf', filters.join(',')] : [];

  await runFFmpeg([
    '-i', videoPath,
    '-i', audioPath,
    ...filterArg,
    '-c:v', 'libx264',
    '-crf', '20',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v',
    '-map', '1:a',
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
    '-i', videoPath,
    '-ss', timeOffset.toString(),
    '-vframes', '1',
    '-vf', 'scale=540:960',
    '-y',
    outputPath,
  ]);
}
