import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn('ffmpeg-static not found, relying on system ffmpeg');
}

export const getFFmpeg = () => ffmpeg;

export function generateSilence(durationSec: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anullsrc')
      .inputFormat('lavfi')
      .duration(durationSec)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export function generatePlaceholderImage(text: string, color: string, outputPath: string): Promise<void> {
  // Use ffmpeg to generate an image with text
  // This is a bit hacky but works without node-canvas
  // requires font config usually, so we might just do color block
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${color}:s=1080x1920`)
      .inputFormat('lavfi')
      .frames(1)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export function concatAudio(files: string[], output: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        files.forEach(f => cmd.input(f));
        cmd.mergeToFile(output) // .mergeToFile is specific to fluent-ffmpeg for concatenation
           .on('end', () => resolve())
           .on('error', (err) => reject(err));
    });
}
