/**
 * QA Validator – sprawdza plik MP4 pod kątem standardu TikTok:
 * - brak ciszy w audio > 2 s (silencedetect)
 * - rozmiar pliku < 287 MB
 * - rozdzielczość 1080×1920
 */
import fs from 'fs';
import { spawn } from 'child_process';
import { validateVideo, getFFmpegPath } from '../ffmpeg/ffmpegUtils.js';

const MAX_FILE_SIZE_BYTES = 287 * 1024 * 1024; // 287 MB
const REQUIRED_WIDTH = 1080;
const REQUIRED_HEIGHT = 1920;
const MAX_SILENCE_DURATION_SEC = 2;

export interface QACheckResult {
  passed: boolean;
  checks: {
    silence: boolean;
    fileSize: boolean;
    resolution: boolean;
  };
  details?: string;
  qaResult?: Record<string, unknown>;
}

/**
 * Sprawdza, czy w audio występuje cisza dłuższa niż MAX_SILENCE_DURATION_SEC.
 * Używa ffmpeg silencedetect; parsuje stderr.
 */
async function checkSilence(mp4Path: string): Promise<{ passed: boolean; details?: string }> {
  try {
    const ffmpeg = await getFFmpegPath();
    const stderr = await new Promise<string>((resolve, reject) => {
      let err = '';
      const proc = spawn(
        ffmpeg,
        [
          '-i',
          mp4Path,
          '-af',
          `silencedetect=n=-50dB:d=${MAX_SILENCE_DURATION_SEC}`,
          '-f',
          'null',
          '-',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );

      proc.stderr?.on('data', (d) => {
        err += d.toString();
      });
      proc.on('close', (_code) => {
        // silencedetect wypisuje na stderr; exit code może być 0
        resolve(err);
      });
      proc.on('error', reject);
    });

    // Format: silence_end: 2.5 | silence_duration: 2.5
    const durationMatch = stderr.match(/silence_duration:\s*([\d.]+)/g);
    if (durationMatch) {
      for (const m of durationMatch) {
        const duration = parseFloat(m.replace('silence_duration:', '').trim());
        if (duration >= MAX_SILENCE_DURATION_SEC) {
          return {
            passed: false,
            details: `Detected silence ≥ ${MAX_SILENCE_DURATION_SEC}s (${duration.toFixed(1)}s)`,
          };
        }
      }
    }
    return { passed: true };
  } catch (e) {
    return { passed: false, details: errorMessage(e) };
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

/**
 * Waliduje plik MP4 pod kątem QA (cisza, rozmiar, rozdzielczość).
 * @param mp4Path – ścieżka bezwzględna do pliku MP4
 */
export async function validateQa(mp4Path: string): Promise<QACheckResult> {
  const result: QACheckResult = {
    passed: true,
    checks: { silence: true, fileSize: true, resolution: true },
  };

  if (!fs.existsSync(mp4Path)) {
    result.passed = false;
    result.checks = { silence: false, fileSize: false, resolution: false };
    result.details = 'File does not exist';
    return result;
  }

  const details: string[] = [];

  // 1. Rozmiar pliku
  const stat = fs.statSync(mp4Path);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    result.checks.fileSize = false;
    result.passed = false;
    details.push(`File size ${(stat.size / (1024 * 1024)).toFixed(1)} MB exceeds 287 MB`);
  }

  // 2. Rozdzielczość (ffprobe)
  const video = await validateVideo(mp4Path);
  if (!video.valid || video.width !== REQUIRED_WIDTH || video.height !== REQUIRED_HEIGHT) {
    result.checks.resolution = false;
    result.passed = false;
    details.push(
      video.width != null && video.height != null
        ? `Resolution ${video.width}×${video.height} (expected ${REQUIRED_WIDTH}×${REQUIRED_HEIGHT})`
        : video.error || 'Invalid or missing video stream'
    );
  }

  // 3. Cisza w audio (silencedetect)
  const silenceResult = await checkSilence(mp4Path);
  if (!silenceResult.passed) {
    result.checks.silence = false;
    result.passed = false;
    details.push(silenceResult.details || 'Silence detected ≥ 2s');
  }

  if (details.length > 0) {
    result.details = details.join('; ');
  }
  result.qaResult = { ...result.checks, details: result.details };
  return result;
}
