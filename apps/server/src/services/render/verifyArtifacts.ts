import fs from 'fs';
import path from 'path';
import { env, isRenderDryRun } from '../../env.js';
import { validateVideo, getMediaDuration } from '../ffmpeg/ffmpegUtils.js';
import type { Run, Project, PlanVersion, Scene } from '@prisma/client';
import type { Artifacts } from '../../utils/types.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';

interface RunWithDetails extends Run {
  project: Project;
  planVersion: PlanVersion & { scenes: Scene[] };
}

export interface VerificationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: Record<string, unknown>;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export async function verifyArtifacts(run: RunWithDetails): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  const artifacts = safeJsonParse<Artifacts>(
    run.artifactsJson,
    {},
    {
      runId: run.id,
      source: 'verifyArtifacts',
    }
  );
  const project = run.project;
  const scenes = run.planVersion.scenes;
  const dryRun = isRenderDryRun() || artifacts.dryRun === true;

  if (dryRun) {
    checks.push({
      name: 'Dry-run Mode',
      passed: true,
      message: 'Dry-run render: no MP4 generated.',
    });

    const imagesDir = artifacts.imagesDir
      ? path.join(env.ARTIFACTS_DIR, artifacts.imagesDir)
      : null;

    if (imagesDir && fs.existsSync(imagesDir)) {
      const imageFiles = fs.readdirSync(imagesDir).filter((f) => f.startsWith('scene_'));
      const expectedCount = scenes.length;

      checks.push({
        name: 'Scene Image Placeholders',
        passed: imageFiles.length >= expectedCount,
        message:
          imageFiles.length >= expectedCount
            ? `All ${expectedCount} scene placeholders present`
            : `Missing placeholders: found ${imageFiles.length}/${expectedCount}`,
        details: { found: imageFiles.length, expected: expectedCount },
      });
    } else {
      checks.push({
        name: 'Scene Image Placeholders',
        passed: false,
        message: 'Images directory not found',
      });
    }

    const audioDir = artifacts.audioDir ? path.join(env.ARTIFACTS_DIR, artifacts.audioDir) : null;
    const voFullPath = audioDir ? path.join(audioDir, 'vo_full.mp3') : null;

    if (voFullPath && fs.existsSync(voFullPath)) {
      checks.push({
        name: 'Voice-over Placeholder',
        passed: true,
        message: 'Voice-over placeholder present',
        details: { path: voFullPath },
      });
    } else {
      checks.push({
        name: 'Voice-over Placeholder',
        passed: false,
        message: 'Voice-over placeholder missing',
      });
    }

    const captionsPath = artifacts.captionsPath
      ? path.join(env.ARTIFACTS_DIR, artifacts.captionsPath)
      : null;

    if (captionsPath && fs.existsSync(captionsPath)) {
      checks.push({
        name: 'Captions File',
        passed: true,
        message: 'Captions file present',
        details: { path: captionsPath },
      });
    } else {
      checks.push({
        name: 'Captions File',
        passed: false,
        message: 'Captions file not found',
      });
    }

    const exportPath = artifacts.exportJsonPath
      ? path.join(env.ARTIFACTS_DIR, artifacts.exportJsonPath)
      : null;

    if (exportPath && fs.existsSync(exportPath)) {
      checks.push({
        name: 'Export JSON',
        passed: true,
        message: 'Export JSON present',
        details: { path: exportPath },
      });
    } else {
      checks.push({
        name: 'Export JSON',
        passed: false,
        message: 'Export JSON file not found',
      });
    }

    checks.push({
      name: 'Final Video File',
      passed: true,
      message: 'Skipped in dry-run mode',
    });

    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed).length;

    return {
      passed: failed === 0,
      checks,
      summary: {
        total: checks.length,
        passed,
        failed,
        warnings: 0,
      },
    };
  }

  // Check 1: Images directory exists with correct count
  const imagesDir = artifacts.imagesDir ? path.join(env.ARTIFACTS_DIR, artifacts.imagesDir) : null;

  if (imagesDir && fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const expectedCount = scenes.length;

    checks.push({
      name: 'Scene Images',
      passed: imageFiles.length >= expectedCount,
      message:
        imageFiles.length >= expectedCount
          ? `All ${expectedCount} scene images present`
          : `Missing images: found ${imageFiles.length}/${expectedCount}`,
      details: { found: imageFiles.length, expected: expectedCount, files: imageFiles },
    });
  } else {
    checks.push({
      name: 'Scene Images',
      passed: false,
      message: 'Images directory not found',
    });
  }

  // Check 2: Voice-over audio exists
  const audioDir = artifacts.audioDir ? path.join(env.ARTIFACTS_DIR, artifacts.audioDir) : null;
  const voFullPath = audioDir ? path.join(audioDir, 'vo_full.mp3') : null;

  if (voFullPath && fs.existsSync(voFullPath)) {
    try {
      const duration = await getMediaDuration(voFullPath);
      checks.push({
        name: 'Voice-over Audio',
        passed: duration > 0,
        message: `Voice-over present: ${duration.toFixed(1)}s`,
        details: { duration, path: voFullPath },
      });
    } catch {
      checks.push({
        name: 'Voice-over Audio',
        passed: false,
        message: 'Voice-over file exists but could not be validated',
      });
    }
  } else {
    checks.push({
      name: 'Voice-over Audio',
      passed: false,
      message: 'Voice-over audio file not found',
    });
  }

  // Check 3: Captions file exists
  const captionsPath = artifacts.captionsPath
    ? path.join(env.ARTIFACTS_DIR, artifacts.captionsPath)
    : null;

  if (captionsPath && fs.existsSync(captionsPath)) {
    const content = fs.readFileSync(captionsPath, 'utf-8');
    const hasDialogue = content.includes('Dialogue:');

    checks.push({
      name: 'Captions File',
      passed: hasDialogue,
      message: hasDialogue
        ? 'Captions file present with dialogue entries'
        : 'Captions file exists but may be empty',
      details: { path: captionsPath, size: fs.statSync(captionsPath).size },
    });
  } else {
    checks.push({
      name: 'Captions File',
      passed: false,
      message: 'Captions file not found',
    });
  }

  // Check 4: Final video exists and is valid
  const mp4Path = artifacts.mp4Path ? path.join(env.ARTIFACTS_DIR, artifacts.mp4Path) : null;

  if (mp4Path && fs.existsSync(mp4Path)) {
    const validation = await validateVideo(mp4Path);

    if (validation.valid && validation.duration) {
      // Check duration is close to target
      const targetDuration = project.targetLengthSec;
      const tolerance = targetDuration >= 180 ? 10 : 5;
      const durationOk = Math.abs(validation.duration - targetDuration) <= tolerance;

      checks.push({
        name: 'Final Video File',
        passed: true,
        message: `Video valid: ${validation.duration.toFixed(1)}s, ${validation.width}x${validation.height}`,
        details: validation,
      });

      checks.push({
        name: 'Video Duration',
        passed: durationOk,
        message: durationOk
          ? `Duration ${validation.duration.toFixed(1)}s matches target ${targetDuration}s (±${tolerance}s)`
          : `Duration ${validation.duration.toFixed(1)}s differs from target ${targetDuration}s by more than ${tolerance}s`,
        details: { actual: validation.duration, target: targetDuration, tolerance },
      });

      // Check resolution
      const isVertical = validation.width === 1080 && validation.height === 1920;
      checks.push({
        name: 'Video Resolution',
        passed: isVertical,
        message: isVertical
          ? 'Correct TikTok resolution (1080x1920)'
          : `Non-standard resolution: ${validation.width}x${validation.height}`,
        details: { width: validation.width, height: validation.height },
      });
    } else {
      checks.push({
        name: 'Final Video File',
        passed: false,
        message: validation.error || 'Video file invalid',
      });
    }
  } else {
    checks.push({
      name: 'Final Video File',
      passed: false,
      message: 'Final video file not found',
    });
  }

  // Check 5: Thumbnail(s) exist
  const thumbPaths = artifacts.thumbPaths as string[] | undefined;
  if (Array.isArray(thumbPaths) && thumbPaths.length > 0) {
    const existing = thumbPaths.filter((p) => {
      const full = path.join(env.ARTIFACTS_DIR, p);
      return fs.existsSync(full);
    });
    checks.push({
      name: 'Thumbnails',
      passed: existing.length === thumbPaths.length,
      message:
        existing.length === thumbPaths.length
          ? `All ${thumbPaths.length} thumbnails present`
          : `Thumbnails: ${existing.length}/${thumbPaths.length} found`,
      details: { paths: thumbPaths, found: existing.length },
    });
  } else {
    const thumbPath = artifacts.thumbPath
      ? path.join(env.ARTIFACTS_DIR, artifacts.thumbPath)
      : null;
    if (thumbPath && fs.existsSync(thumbPath)) {
      checks.push({
        name: 'Thumbnail',
        passed: true,
        message: 'Thumbnail image present',
        details: { path: thumbPath, size: fs.statSync(thumbPath).size },
      });
    } else {
      checks.push({
        name: 'Thumbnail',
        passed: false,
        message: 'Thumbnail image not found',
      });
    }
  }

  // Check 6: Export JSON exists
  const exportPath = artifacts.exportJsonPath
    ? path.join(env.ARTIFACTS_DIR, artifacts.exportJsonPath)
    : null;

  if (exportPath && fs.existsSync(exportPath)) {
    try {
      const exportData = safeJsonParse<Record<string, unknown>>(
        fs.readFileSync(exportPath, 'utf-8'),
        {},
        { source: 'exportJson', path: exportPath }
      );
      const hasProject = Boolean(exportData.project);
      const hasPlan = Boolean(exportData.plan);
      const hasRender = Boolean(exportData.render);
      const hasRequiredFields = hasProject && hasPlan && hasRender;

      checks.push({
        name: 'Export JSON',
        passed: hasRequiredFields,
        message: hasRequiredFields
          ? 'Export JSON valid with all required fields'
          : 'Export JSON missing required fields',
        details: {
          hasProject,
          hasPlan,
          hasRender,
        },
      });
    } catch {
      checks.push({
        name: 'Export JSON',
        passed: false,
        message: 'Export JSON file is invalid',
      });
    }
  } else {
    checks.push({
      name: 'Export JSON',
      passed: false,
      message: 'Export JSON file not found',
    });
  }

  // Calculate summary
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  return {
    passed: failed === 0,
    checks,
    summary: {
      total: checks.length,
      passed,
      failed,
      warnings: 0,
    },
  };
}
