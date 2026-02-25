import { prisma } from '../../db/client.js';
import { logError, logWarn } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import pLimit from 'p-limit';
import {
  env,
  getDryRunFailStep,
  getDryRunStepDelayMs,
  isRenderDryRun,
  isTestMode,
} from '../../env.js';
import { getNichePack } from '../nichePacks.js';
import { generateTTS, transcribeAudio, generateImage } from '../providers/openai.js';
import { buildCaptionsFromWords, buildCaptionsFromScenes } from '../captions/captionsBuilder.js';
import { COMPOSITION_REQUIREMENTS } from './compositionRequirements.js';
import {
  createSceneVideo,
  concatenateVideos,
  concatenateAudio,
  mixAudio,
  finalComposite,
  extractThumbnail,
  getMediaDuration,
} from '../ffmpeg/ffmpegUtils.js';
import { validateQa } from '../qa/qaValidator.js';
import { generateTikTokMeta } from '../tiktokExport.js';
import { broadcastRunUpdate } from '../../routes/run.js';
import type { Run, PlanVersion, Scene, Project } from '@prisma/client';
import type { Artifacts, ResumeState } from '../../utils/types.js';

interface PlanWithDetails extends PlanVersion {
  scenes: Scene[];
  project: Project;
}

type RunStep =
  | 'tts_generate'
  | 'asr_align'
  | 'images_generate'
  | 'captions_build'
  | 'music_build'
  | 'ffmpeg_render'
  | 'finalize_artifacts';

const STEPS: RunStep[] = [
  'tts_generate',
  'asr_align',
  'images_generate',
  'captions_build',
  'music_build',
  'ffmpeg_render',
  'finalize_artifacts',
];

const STEP_WEIGHTS: Record<RunStep, number> = {
  tts_generate: 20,
  asr_align: 10,
  images_generate: 35,
  captions_build: 5,
  music_build: 5,
  ffmpeg_render: 20,
  finalize_artifacts: 5,
};

// Maximum concurrent image generation requests
// Default: 3 concurrent requests to balance speed with resource usage
const rawMaxConcurrentImages = process.env.MAX_CONCURRENT_IMAGE_GENERATION;
const parsedMaxConcurrentImages = rawMaxConcurrentImages
  ? Number.parseInt(rawMaxConcurrentImages, 10)
  : 3;
const MAX_CONCURRENT_IMAGE_GENERATION =
  Number.isInteger(parsedMaxConcurrentImages) && parsedMaxConcurrentImages > 0
    ? parsedMaxConcurrentImages
    : (() => {
        if (rawMaxConcurrentImages) {
          logWarn(
            `Invalid MAX_CONCURRENT_IMAGE_GENERATION value "${rawMaxConcurrentImages}", falling back to default (3).`
          );
        }
        return 3;
      })();

// Active runs for cancellation
const activeRuns = new Map<string, boolean>();

// Queue: max 1 render at a time; runIds waiting to start
const renderQueue: string[] = [];
let currentRunningRunId: string | null = null;

async function processNextInQueue(): Promise<void> {
  // Guard against concurrent processing: only one render at a time
  if (currentRunningRunId !== null) return;
  if (renderQueue.length === 0) return;
  const runId = renderQueue.shift()!;
  try {
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
            project: true,
          },
        },
      },
    });
    if (!run || run.status !== 'queued') {
      // Skip canceled/invalid runs and process the next one in queue
      processNextInQueue().catch((nextErr) => {
        logError('Failed to process next in queue (after skipping invalid run):', nextErr);
      });
      return;
    }
    currentRunningRunId = runId;
    try {
      await prisma.project.update({
        where: { id: run.projectId },
        data: { status: 'RENDERING' },
      });
    } catch (updateErr) {
      // If the project update fails, unblock the queue so subsequent runs can proceed
      currentRunningRunId = null;
      logError('Failed to set project status to RENDERING, releasing queue lock:', updateErr);
      processNextInQueue().catch((nextErr) => {
        logError('Failed to process next in queue (after update error):', nextErr);
      });
      return;
    }
    activeRuns.set(runId, true);
    executePipeline(run, run.planVersion as PlanWithDetails).catch((err) => {
      logError('Pipeline execution failed (from queue):', err);
      handlePipelineError(runId, err);
    });
  } catch (err) {
    // currentRunningRunId was never set at this point (set only after findUnique succeeds
    // and run is valid), so no need to clear it here
    logError('Failed to process next in queue:', err);
    processNextInQueue().catch((nextErr) => {
      logError('Failed to process next in queue (from error handler):', nextErr);
    });
  }
}

async function handlePipelineError(runId: string, error: unknown): Promise<void> {
  try {
    const currentRun = await prisma.run.findUnique({ where: { id: runId } });
    if (currentRun && (currentRun.status === 'running' || currentRun.status === 'queued')) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const logs = safeJsonParse<Array<{ timestamp: string; message: string; level: string }>>(
        currentRun.logsJson,
        [],
        { runId: currentRun.id, source: 'handlePipelineError' }
      );
      logs.push({
        timestamp: new Date().toISOString(),
        message: `Pipeline failed: ${errorMessage}`,
        level: 'error',
      });
      await prisma.run.update({
        where: { id: runId },
        data: { status: 'failed', logsJson: JSON.stringify(logs), currentStep: 'error' },
      });
      await prisma.project.update({
        where: { id: currentRun.projectId },
        data: { status: 'FAILED' },
      });
      broadcastRunUpdate(runId, { type: 'failed', error: errorMessage });
    }
  } catch (e) {
    logError('Error in handlePipelineError:', e);
  }
  // Note: executePipeline's finally will set currentRunningRunId = null and call processNextInQueue
}

function shouldFailStep(step: RunStep): boolean {
  return isRenderDryRun() && getDryRunFailStep() === step;
}

async function delayOrCancel(step: RunStep, runId: string): Promise<boolean> {
  if (!isRenderDryRun()) {
    return false;
  }

  const delayMs = getDryRunStepDelayMs();
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (!isActive(runId)) {
    await addLog(runId, `Run canceled before ${step} step`, 'warn');
    return true;
  }

  return false;
}

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writePlaceholderFile(filePath: string, contents: string) {
  ensureDirExists(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents);
  }
}

function buildDryRunTranscription(scenes: Scene[]) {
  const text = scenes.map((s) => s.narrationText).join(' ');
  return { text, words: [] as Array<{ word: string; start: number; end: number }> };
}

// Start render pipeline
export async function startRenderPipeline(planVersion: PlanWithDetails): Promise<Run> {
  if (isTestMode()) {
    throw new Error('Rendering disabled in APP_TEST_MODE');
  }

  const runId = uuid();
  const projectId = planVersion.projectId;

  // Create run record
  const run = await prisma.run.create({
    data: {
      id: runId,
      projectId,
      planVersionId: planVersion.id,
      status: 'queued',
      progress: 0,
      currentStep: '',
      logsJson: JSON.stringify([]),
      artifactsJson: JSON.stringify({}),
      resumeStateJson: JSON.stringify({}),
    },
  });

  // Queue: if a run is already in progress, enqueue this one; otherwise start now
  if (currentRunningRunId !== null) {
    renderQueue.push(runId);
    return run;
  }

  currentRunningRunId = runId;
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'RENDERING' },
    });
  } catch (err) {
    // If status update fails, release the queue lock so future runs are not stuck
    currentRunningRunId = null;
    throw err;
  }
  activeRuns.set(runId, true);
  executePipeline(run, planVersion).catch((error) => {
    logError('Pipeline execution failed:', error);
    handlePipelineError(runId, error);
  });

  return run;
}

// Execute the full pipeline
async function executePipeline(run: Run, planVersion: PlanWithDetails) {
  const runId = run.id;
  const projectId = run.projectId;
  const project = planVersion.project;
  const scenes = planVersion.scenes;
  const dryRun = isRenderDryRun();

  // Create artifacts directory
  const artifactsDir = path.join(env.ARTIFACTS_DIR, projectId, runId);
  const imagesDir = path.join(artifactsDir, 'images');
  const audioDir = path.join(artifactsDir, 'audio');
  const captionsDir = path.join(artifactsDir, 'captions');
  const finalDir = path.join(artifactsDir, 'final');
  const videoDir = path.join(artifactsDir, 'video');

  for (const dir of [imagesDir, audioDir, captionsDir, finalDir, videoDir]) {
    ensureDirExists(dir);
  }

  // Initialize artifacts
  const artifacts: Artifacts = {
    imagesDir: path.relative(env.ARTIFACTS_DIR, imagesDir),
    audioDir: path.relative(env.ARTIFACTS_DIR, audioDir),
    dryRun,
  };

  let totalCostUsd = 0;
  const resumeState = safeJsonParse<ResumeState>(
    run.resumeStateJson,
    { completedSteps: [], completedSceneIdxs: [] },
    { runId: run.id, source: 'startRenderPipeline' }
  );

  const completedSteps = resumeState.completedSteps || [];
  let progress = 0;

  try {
    await updateRun(runId, { status: 'running' });

    // Step 1: TTS Generate
    if (!completedSteps.includes('tts_generate') && isActive(runId)) {
      if (await delayOrCancel('tts_generate', runId)) {
        return;
      }

      if (shouldFailStep('tts_generate')) {
        throw new Error('Dry-run failure injected at tts_generate');
      }

      await updateStep(runId, 'tts_generate', 'Generating voice-over audio...');

      const sceneAudioPaths: string[] = [];
      const sceneAudioDurations: number[] = [];

      for (let i = 0; i < scenes.length; i++) {
        if (!isActive(runId)) break;

        const scene = scenes[i];
        const audioPath = path.join(audioDir, `scene_${String(i).padStart(2, '0')}.mp3`);

        await addLog(runId, `Generating TTS for scene ${i + 1}/${scenes.length}...`);

        if (!fs.existsSync(audioPath)) {
          if (dryRun) {
            writePlaceholderFile(audioPath, `[dry-run audio]\n${scene.narrationText}\n`);
          } else {
            const ttsResult = await generateTTS(
              scene.narrationText,
              audioPath,
              project.voicePreset
            );
            totalCostUsd += ttsResult.estimatedCostUsd;
          }
        }

        sceneAudioPaths.push(audioPath);

        // Measure actual audio duration
        // Note: In dry-run mode, we skip measurement since placeholder files don't have accurate audio data
        let audioDuration = scene.durationTargetSec;
        if (!dryRun && fs.existsSync(audioPath)) {
          try {
            audioDuration = await getMediaDuration(audioPath);
            await addLog(
              runId,
              `Scene ${i + 1} audio duration: ${audioDuration.toFixed(2)}s (target: ${scene.durationTargetSec.toFixed(2)}s)`
            );
          } catch (error) {
            logWarn(`Failed to get audio duration for scene ${i}, using target duration:`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        sceneAudioDurations.push(audioDuration);

        // Update progress within step
        const stepProgress = ((i + 1) / scenes.length) * STEP_WEIGHTS.tts_generate;
        await updateProgress(runId, Math.round(stepProgress));
      }

      // Update scene durations and recalculate timings based on measured audio
      // Note: This executes whenever at least one scene had audio generated (i.e., a duration was pushed above)
      if (sceneAudioDurations.length > 0 && isActive(runId)) {
        await addLog(runId, 'Updating scene durations based on audio...');

        // Precompute all updated timing data so we can apply it atomically
        let currentTime = 0;
        const updatedScenesData: Array<{
          id: string;
          durationTargetSec: number;
          startTimeSec: number;
          endTimeSec: number;
        }> = [];

        // Only update scenes for which audio was actually generated
        for (let i = 0; i < sceneAudioDurations.length; i++) {
          const scene = scenes[i];
          const newDuration = sceneAudioDurations[i];
          const startTimeSec = currentTime;
          const endTimeSec = currentTime + newDuration;

          currentTime = endTimeSec;

          updatedScenesData.push({
            id: scene.id,
            durationTargetSec: newDuration,
            startTimeSec,
            endTimeSec,
          });
        }

        // Apply all scene updates in a single transaction to avoid partial updates
        await prisma.$transaction(async (tx) => {
          for (const updated of updatedScenesData) {
            await tx.scene.update({
              where: { id: updated.id },
              data: {
                durationTargetSec: updated.durationTargetSec,
                startTimeSec: updated.startTimeSec,
                endTimeSec: updated.endTimeSec,
              },
            });
          }
        });

        // Only update local scene objects after the transaction has succeeded
        for (let i = 0; i < updatedScenesData.length; i++) {
          const scene = scenes[i];
          const updated = updatedScenesData[i];

          scene.durationTargetSec = updated.durationTargetSec;
          scene.startTimeSec = updated.startTimeSec;
          scene.endTimeSec = updated.endTimeSec;
        }

        await addLog(
          runId,
          `Updated ${updatedScenesData.length} scene(s) with measured audio durations`
        );
      }

      // Concatenate audio
      const voFullPath = path.join(audioDir, 'vo_full.mp3');
      if (sceneAudioPaths.length > 0 && !fs.existsSync(voFullPath)) {
        if (dryRun) {
          await addLog(runId, 'Creating dry-run voice-over placeholder...');
          writePlaceholderFile(
            voFullPath,
            `[dry-run voice-over]\n${scenes.map((s) => s.narrationText).join('\n')}\n`
          );
        } else {
          await addLog(runId, 'Concatenating voice-over audio...');
          await concatenateAudio(sceneAudioPaths, voFullPath);
        }
      }

      completedSteps.push('tts_generate');
      await saveResumeState(runId, { completedSteps });
      progress += STEP_WEIGHTS.tts_generate;
    }

    // Step 2: ASR Align
    if (!completedSteps.includes('asr_align') && isActive(runId)) {
      if (await delayOrCancel('asr_align', runId)) {
        return;
      }

      if (shouldFailStep('asr_align')) {
        throw new Error('Dry-run failure injected at asr_align');
      }

      await updateStep(runId, 'asr_align', 'Transcribing audio for captions...');

      const voFullPath = path.join(audioDir, 'vo_full.mp3');
      const timestampsPath = path.join(captionsDir, 'timestamps.json');

      if (fs.existsSync(voFullPath) && !fs.existsSync(timestampsPath)) {
        if (dryRun) {
          const transcription = buildDryRunTranscription(scenes);
          fs.writeFileSync(timestampsPath, JSON.stringify(transcription, null, 2));
        } else {
          const transResult = await transcribeAudio(voFullPath);
          totalCostUsd += transResult.estimatedCostUsd;
          fs.writeFileSync(
            timestampsPath,
            JSON.stringify({ text: transResult.text, words: transResult.words }, null, 2)
          );
        }
      }

      completedSteps.push('asr_align');
      await saveResumeState(runId, { completedSteps });
      progress += STEP_WEIGHTS.asr_align;
      await updateProgress(runId, progress);
    }

    // Step 3: Generate Images (Parallelized)
    if (!completedSteps.includes('images_generate') && isActive(runId)) {
      if (await delayOrCancel('images_generate', runId)) {
        return;
      }

      if (shouldFailStep('images_generate')) {
        throw new Error('Dry-run failure injected at images_generate');
      }

      await updateStep(runId, 'images_generate', 'Generating scene images...');

      const pack = getNichePack(project.nichePackId);

      // Create a concurrency limiter for image generation
      const limit = pLimit(MAX_CONCURRENT_IMAGE_GENERATION);

      // Track completed images for progress updates
      let completedImages = 0;

      // Create an array of image generation tasks
      const imageGenerationTasks = scenes.map((scene, i) => {
        const imagePath = path.join(imagesDir, `scene_${String(i).padStart(2, '0')}.png`);

        // Return a limited task that generates the image
        return limit(async () => {
          // Check if run is still active (early return on cancellation is safe;
          // remaining tasks will complete gracefully and next step check will exit)
          if (!isActive(runId)) return { cost: 0, skipped: true };

          // Skip if image already exists
          if (fs.existsSync(imagePath)) {
            completedImages++;
            const stepProgress =
              progress + (completedImages / scenes.length) * STEP_WEIGHTS.images_generate;
            await updateProgress(runId, Math.round(stepProgress));
            return { cost: 0, skipped: true };
          }

          await addLog(runId, `Generating image for scene ${i + 1}/${scenes.length}...`);

          // Build full prompt with explicit composition requirements
          const fullPrompt = [
            pack?.styleBiblePrompt || '',
            scene.visualPrompt,
            COMPOSITION_REQUIREMENTS,
          ]
            .filter(Boolean)
            .join('. ');

          // Use scene negative prompt (already contains global from plan generation)
          // Fall back to pack global if scene prompt is empty (for backward compatibility)
          const negativePrompt =
            scene.negativePrompt?.trim() || pack?.globalNegativePrompt?.trim() || '';

          let cost = 0;
          if (dryRun) {
            const negativePromptDisplay = negativePrompt || '(none)';
            const dryRunContent = `[dry-run image]\nPrompt: ${fullPrompt}\nNegative Prompt: ${negativePromptDisplay}\n`;
            writePlaceholderFile(imagePath, dryRunContent);
          } else {
            const imgResult = await generateImage(
              fullPrompt,
              imagePath,
              '1024x1792',
              negativePrompt
            );
            cost = imgResult.estimatedCostUsd;
          }

          // Update progress after each image completes
          completedImages++;
          const stepProgress =
            progress + (completedImages / scenes.length) * STEP_WEIGHTS.images_generate;
          await updateProgress(runId, Math.round(stepProgress));

          return { cost, skipped: false };
        });
      });

      // Wait for all image generation tasks to complete (allowing per-task failures)
      const imageResults = await Promise.allSettled(imageGenerationTasks);

      // Collect any failed image generations
      const failedImages = imageResults
        .map((result, index) => ({ result, index }))
        .filter(
          (r): r is { result: PromiseRejectedResult; index: number } =>
            r.result.status === 'rejected'
        );

      if (failedImages.length > 0) {
        // Log each failure with context, then fail the step after all tasks have completed
        for (const { result, index } of failedImages) {
          const reason = result.reason;
          const message =
            reason instanceof Error ? reason.message : String(reason ?? 'Unknown error');
          logError('Image generation failed', {
            runId,
            sceneIndex: index,
            error: message,
          });
        }

        throw new Error(
          `Failed to generate ${failedImages.length} image(s) out of ${scenes.length}`
        );
      }

      // Accumulate costs from successful results (avoiding race conditions)
      const successfulResults = imageResults.filter(
        (r): r is PromiseFulfilledResult<{ cost: number; skipped: boolean }> =>
          r.status === 'fulfilled'
      );
      for (const { value } of successfulResults) {
        totalCostUsd += value.cost;
      }

      completedSteps.push('images_generate');
      await saveResumeState(runId, { completedSteps });
      progress += STEP_WEIGHTS.images_generate;
    }

    // Step 4: Build Captions
    if (!completedSteps.includes('captions_build') && isActive(runId)) {
      if (await delayOrCancel('captions_build', runId)) {
        return;
      }

      if (shouldFailStep('captions_build')) {
        throw new Error('Dry-run failure injected at captions_build');
      }

      await updateStep(runId, 'captions_build', 'Building captions...');

      const pack = getNichePack(project.nichePackId);
      const captionsPath = path.join(captionsDir, 'captions.ass');
      const timestampsPath = path.join(captionsDir, 'timestamps.json');

      if (!fs.existsSync(captionsPath)) {
        if (fs.existsSync(timestampsPath)) {
          const transcription = safeJsonParse<{
            words?: Array<{ word: string; start: number; end: number }>;
          }>(
            fs.readFileSync(timestampsPath, 'utf-8'),
            {},
            { source: 'captionsTimestamps', path: timestampsPath }
          );

          if (transcription.words && transcription.words.length > 0) {
            buildCaptionsFromWords(transcription.words, pack!.captionStyle, captionsPath);
          } else {
            buildCaptionsFromScenes(
              scenes.map((s) => ({
                narrationText: s.narrationText,
                startTimeSec: s.startTimeSec,
                endTimeSec: s.endTimeSec,
              })),
              pack!.captionStyle,
              captionsPath
            );
          }
        } else {
          buildCaptionsFromScenes(
            scenes.map((s) => ({
              narrationText: s.narrationText,
              startTimeSec: s.startTimeSec,
              endTimeSec: s.endTimeSec,
            })),
            pack!.captionStyle,
            captionsPath
          );
        }
      }

      artifacts.captionsPath = path.relative(env.ARTIFACTS_DIR, captionsPath);
      completedSteps.push('captions_build');
      await saveResumeState(runId, { completedSteps });
      progress += STEP_WEIGHTS.captions_build;
      await updateProgress(runId, progress);
    }

    // Step 5: Music Build (optional)
    if (!completedSteps.includes('music_build') && isActive(runId)) {
      if (await delayOrCancel('music_build', runId)) {
        return;
      }

      if (shouldFailStep('music_build')) {
        throw new Error('Dry-run failure injected at music_build');
      }

      await updateStep(runId, 'music_build', 'Processing background music...');

      const voFullPath = path.join(audioDir, 'vo_full.mp3');
      const mixedAudioPath = path.join(audioDir, 'mixed.mp3');

      if (dryRun) {
        writePlaceholderFile(mixedAudioPath, '[dry-run mixed audio]\n');
      } else {
        // Check for music files
        let musicPath: string | null = null;
        if (fs.existsSync(env.MUSIC_LIBRARY_DIR)) {
          const musicFiles = fs
            .readdirSync(env.MUSIC_LIBRARY_DIR)
            .filter((f) => /\.(mp3|wav|m4a)$/i.test(f));

          if (musicFiles.length > 0) {
            // Pick first music file for now
            musicPath = path.join(env.MUSIC_LIBRARY_DIR, musicFiles[0]);
            await addLog(runId, `Using background music: ${musicFiles[0]}`);
          }
        }

        if (!fs.existsSync(mixedAudioPath) && fs.existsSync(voFullPath)) {
          await mixAudio(voFullPath, musicPath, mixedAudioPath);
        }
      }

      completedSteps.push('music_build');
      await saveResumeState(runId, { completedSteps });
      progress += STEP_WEIGHTS.music_build;
      await updateProgress(runId, progress);
    }

    // Step 6: FFmpeg Render
    if (!completedSteps.includes('ffmpeg_render') && isActive(runId)) {
      if (await delayOrCancel('ffmpeg_render', runId)) {
        return;
      }

      if (shouldFailStep('ffmpeg_render')) {
        throw new Error('Dry-run failure injected at ffmpeg_render');
      }

      await updateStep(runId, 'ffmpeg_render', 'Rendering video...');

      if (dryRun) {
        const reportPath = path.join(finalDir, 'dry_run_report.txt');
        writePlaceholderFile(
          reportPath,
          'Dry-run render completed. No MP4 generated or FFmpeg executed.\n'
        );
        artifacts.dryRunReportPath = path.relative(env.ARTIFACTS_DIR, reportPath);
        completedSteps.push('ffmpeg_render');
        await saveResumeState(runId, { completedSteps });
        progress += STEP_WEIGHTS.ffmpeg_render;
        await updateProgress(runId, progress);
      } else {
        const sceneVideoPaths: string[] = [];

        // Create scene videos with motion effects
        for (let i = 0; i < scenes.length; i++) {
          if (!isActive(runId)) break;

          const scene = scenes[i];
          const imagePath = path.join(imagesDir, `scene_${String(i).padStart(2, '0')}.png`);
          const videoPath = path.join(videoDir, `scene_${String(i).padStart(2, '0')}.mp4`);

          if (!fs.existsSync(videoPath) && fs.existsSync(imagePath)) {
            await addLog(runId, `Creating video segment ${i + 1}/${scenes.length}...`);
            await createSceneVideo(
              imagePath,
              scene.durationTargetSec,
              scene.effectPreset,
              videoPath
            );
          }

          if (fs.existsSync(videoPath)) {
            sceneVideoPaths.push(videoPath);
          }

          // Update progress
          const stepProgress =
            progress + ((i + 1) / scenes.length) * (STEP_WEIGHTS.ffmpeg_render * 0.5);
          await updateProgress(runId, Math.round(stepProgress));
        }

        // Concatenate scenes
        const rawVideoPath = path.join(finalDir, 'raw.mp4');
        if (sceneVideoPaths.length > 0 && !fs.existsSync(rawVideoPath)) {
          await addLog(runId, 'Concatenating video segments...');
          await concatenateVideos(sceneVideoPaths, rawVideoPath);
        }

        // Final composite with audio and captions
        const mixedAudioPath = path.join(audioDir, 'mixed.mp3');
        const captionsPath = path.join(captionsDir, 'captions.ass');
        const finalVideoPath = path.join(finalDir, 'final.mp4');

        const audioToUse = fs.existsSync(mixedAudioPath)
          ? mixedAudioPath
          : path.join(audioDir, 'vo_full.mp3');

        if (
          !fs.existsSync(finalVideoPath) &&
          fs.existsSync(rawVideoPath) &&
          fs.existsSync(audioToUse)
        ) {
          await addLog(runId, 'Creating final video with audio and captions...');
          await finalComposite(rawVideoPath, audioToUse, captionsPath, finalVideoPath);
        }

        artifacts.mp4Path = path.relative(env.ARTIFACTS_DIR, finalVideoPath);
        completedSteps.push('ffmpeg_render');
        await saveResumeState(runId, { completedSteps });
        progress += STEP_WEIGHTS.ffmpeg_render;
        await updateProgress(runId, progress);
      }
    }

    // Step 7: Finalize Artifacts
    if (!completedSteps.includes('finalize_artifacts') && isActive(runId)) {
      if (await delayOrCancel('finalize_artifacts', runId)) {
        return;
      }

      if (shouldFailStep('finalize_artifacts')) {
        throw new Error('Dry-run failure injected at finalize_artifacts');
      }

      await updateStep(runId, 'finalize_artifacts', 'Finalizing...');

      artifacts.costEstimate = {
        estimatedUsd: Math.round(totalCostUsd * 100) / 100,
      };

      const finalVideoPath = path.join(finalDir, 'final.mp4');
      const exportPath = path.join(finalDir, 'export.json');

      // Extract 3 thumbnails: start, 3s, mid (for "Use as cover" choice)
      const thumbPaths: string[] = [];
      if (!dryRun && fs.existsSync(finalVideoPath)) {
        const thumb0Path = path.join(finalDir, 'thumb_0.png');
        const thumb3Path = path.join(finalDir, 'thumb_3.png');
        const thumbMidPath = path.join(finalDir, 'thumb_mid.png');
        const needThumbs =
          !fs.existsSync(thumb0Path) || !fs.existsSync(thumb3Path) || !fs.existsSync(thumbMidPath);
        if (needThumbs) {
          await addLog(runId, 'Extracting thumbnails...');
          const durationSec = await getMediaDuration(finalVideoPath);
          const midOffset = Math.max(0, durationSec / 2 - 0.5);
          if (!fs.existsSync(thumb0Path)) await extractThumbnail(finalVideoPath, thumb0Path, 0);
          if (!fs.existsSync(thumb3Path)) await extractThumbnail(finalVideoPath, thumb3Path, 3);
          if (!fs.existsSync(thumbMidPath))
            await extractThumbnail(finalVideoPath, thumbMidPath, midOffset);
        }
        thumbPaths.push(
          path.relative(env.ARTIFACTS_DIR, path.join(finalDir, 'thumb_0.png')),
          path.relative(env.ARTIFACTS_DIR, path.join(finalDir, 'thumb_3.png')),
          path.relative(env.ARTIFACTS_DIR, path.join(finalDir, 'thumb_mid.png'))
        );
        artifacts.thumbPaths = thumbPaths;
        artifacts.thumbPath = thumbPaths[0];
      }

      // TikTok metadata (caption, hashtags, title) – only when not dry-run
      let tiktokCaption: string | undefined;
      let tiktokHashtags: string[] = [];
      let tiktokTitle: string | undefined;
      if (!dryRun) {
        try {
          await addLog(runId, 'Generating TikTok caption and hashtags...');
          const tiktok = await generateTikTokMeta({
            topic: project.topic,
            nichePackId: project.nichePackId,
            hookSelected: planVersion.hookSelected,
            outline: planVersion.outline,
          });
          tiktokCaption = tiktok.caption;
          tiktokHashtags = tiktok.hashtags;
          tiktokTitle = tiktok.title;
          artifacts.tiktokCaption = tiktokCaption;
          artifacts.tiktokHashtags = tiktokHashtags;
          artifacts.tiktokTitle = tiktokTitle;
        } catch (err) {
          await addLog(
            runId,
            `TikTok meta failed: ${err instanceof Error ? err.message : 'unknown'}`,
            'warn'
          );
        }
      }

      // Create export JSON
      if (!fs.existsSync(exportPath)) {
        const exportData: Record<string, unknown> = {
          project: {
            id: project.id,
            title: project.title,
            topic: project.topic,
            nichePackId: project.nichePackId,
            language: project.language,
            targetLengthSec: project.targetLengthSec,
          },
          plan: {
            hookSelected: planVersion.hookSelected,
            outline: planVersion.outline,
            scenes: scenes.map((s) => ({
              idx: s.idx,
              narrationText: s.narrationText,
              visualPrompt: s.visualPrompt,
              durationTargetSec: s.durationTargetSec,
            })),
          },
          render: {
            runId,
            completedAt: new Date().toISOString(),
            dryRun,
          },
          artifacts,
        };
        if (tiktokCaption !== undefined || tiktokTitle !== undefined) {
          exportData.tiktok = {
            caption: tiktokCaption ?? '',
            hashtags: tiktokHashtags,
            title: tiktokTitle ?? '',
          };
        }
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      }

      artifacts.exportJsonPath = path.relative(env.ARTIFACTS_DIR, exportPath);

      completedSteps.push('finalize_artifacts');
      await saveResumeState(runId, { completedSteps });
      progress = 100;
      await updateProgress(runId, progress);
    }

    // QA check (only when we have real MP4, not dry-run)
    if (isActive(runId) && !dryRun) {
      const finalVideoPath = path.join(finalDir, 'final.mp4');
      if (fs.existsSync(finalVideoPath)) {
        const qaResult = await validateQa(finalVideoPath);
        artifacts.qaResult = qaResult.qaResult;
        if (!qaResult.passed) {
          await updateRun(runId, {
            status: 'qa_failed',
            progress: 100,
            currentStep: 'complete',
            artifactsJson: JSON.stringify(artifacts),
          });
          await addLog(runId, `QA failed: ${qaResult.details || 'checks failed'}`, 'warn');
          broadcastRunUpdate(runId, { type: 'state', status: 'qa_failed', progress: 100 });
          return;
        }
      }
    }

    // Mark as complete
    if (isActive(runId)) {
      await updateRun(runId, {
        status: 'done',
        progress: 100,
        currentStep: 'complete',
        artifactsJson: JSON.stringify(artifacts),
      });

      await addLog(runId, 'Render complete!');

      // Update project status
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'DONE' },
      });

      broadcastRunUpdate(runId, { type: 'done', progress: 100 });
    }
  } catch (error) {
    logError('Pipeline error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    artifacts.costEstimate = {
      estimatedUsd: Math.round(totalCostUsd * 100) / 100,
    };
    await updateRun(runId, {
      status: 'failed',
      currentStep: 'error',
      artifactsJson: JSON.stringify(artifacts),
    });

    await addLog(runId, `Error: ${errorMessage}`, 'error');

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'FAILED' },
    });

    broadcastRunUpdate(runId, { type: 'failed', error: errorMessage });
  } finally {
    activeRuns.delete(runId);

    // Clean up log queues and wait for any pending log processing to complete
    const pendingLogProcessing = logProcessing.get(runId);
    if (pendingLogProcessing) {
      try {
        await pendingLogProcessing;
      } catch {
        // Log processing error already handled, just ensure cleanup continues
      }
    }
    logQueues.delete(runId);
    logProcessing.delete(runId);

    if (currentRunningRunId === runId) {
      currentRunningRunId = null;
      processNextInQueue().catch((err) => logError('Error processing next in queue', err));
    }
  }
}

// Reset runs stuck in 'running' after server restart (no in-memory activeRuns)
// and restore queued runs back to the in-memory queue
export async function resetStuckRuns(): Promise<void> {
  // 1. Handle stuck 'running' runs - mark as failed
  const stuck = await prisma.run.findMany({
    where: { status: 'running' },
    select: { id: true, projectId: true, logsJson: true },
  });
  for (const run of stuck) {
    const logs = safeJsonParse<Array<{ timestamp: string; message: string; level: string }>>(
      run.logsJson,
      [],
      { runId: run.id, source: 'resetStuckRuns' }
    );
    logs.push({
      timestamp: new Date().toISOString(),
      message: 'Run was in "running" state at server start; marked as failed. Use Retry to resume.',
      level: 'warn',
    });
    await prisma.run.update({
      where: { id: run.id },
      data: { status: 'failed', logsJson: JSON.stringify(logs), currentStep: 'error' },
    });
    await prisma.project.update({
      where: { id: run.projectId },
      data: { status: 'FAILED' },
    });
  }
  if (stuck.length > 0) {
    logWarn(`Reset ${stuck.length} run(s) stuck in "running" state.`);
  }

  // 2. Restore queued runs back to the in-memory queue
  const queuedRuns = await prisma.run.findMany({
    where: { status: 'queued' },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'asc' }, // Oldest first to maintain FIFO order
  });

  // Use a Set for O(1) lookup to avoid O(n²) complexity
  const existingQueueIds = new Set(renderQueue);
  for (const run of queuedRuns) {
    // Avoid adding duplicate run IDs if resetStuckRuns() is invoked multiple times
    if (!existingQueueIds.has(run.id)) {
      renderQueue.push(run.id);
    }
  }

  if (queuedRuns.length > 0) {
    logWarn(`Restored ${queuedRuns.length} queued run(s) to in-memory queue.`);
    // Start processing the queue if no run is currently running
    if (currentRunningRunId === null) {
      processNextInQueue().catch((err) =>
        logError('Failed to process restored queue on startup:', err)
      );
    }
  }
}

// Retry run from a specific step (atomic: only one retry can proceed per run)
export async function retryRun(runId: string, fromStep?: string): Promise<Run> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      planVersion: {
        include: {
          scenes: { orderBy: { idx: 'asc' } },
          project: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  // Reset completed steps if retrying from a specific step
  const resumeState = safeJsonParse<{ completedSteps?: RunStep[] }>(
    run.resumeStateJson,
    {},
    { runId: run.id, source: 'retryRun' }
  );
  if (fromStep) {
    const stepIndex = STEPS.indexOf(fromStep as RunStep);
    if (stepIndex >= 0) {
      resumeState.completedSteps = STEPS.slice(0, stepIndex);
    } else {
      resumeState.completedSteps = [];
    }
  } else {
    resumeState.completedSteps = [];
  }

  // Atomic check-and-set: only transition from failed/canceled/qa_failed to queued
  const result = await prisma.run.updateMany({
    where: {
      id: runId,
      status: { in: ['failed', 'canceled', 'qa_failed'] },
    },
    data: {
      status: 'queued',
      resumeStateJson: JSON.stringify(resumeState),
    },
  });

  if (result.count === 0) {
    const current = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
    if (!current) throw new Error('Run not found');
    if (current.status === 'running' || current.status === 'queued') {
      throw new Error('Run is already in progress');
    }
    throw new Error('Run is not retryable from current state');
  }

  const updatedRun = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      planVersion: {
        include: {
          scenes: { orderBy: { idx: 'asc' } },
          project: true,
        },
      },
    },
  });

  if (!updatedRun) throw new Error('Run not found');

  if (currentRunningRunId !== null) {
    renderQueue.push(runId);
    return updatedRun as Run;
  }
  currentRunningRunId = runId;
  try {
    await prisma.project.update({
      where: { id: updatedRun.projectId },
      data: { status: 'RENDERING' },
    });
  } catch (err) {
    // Release queue lock if status update fails so future runs are not stuck
    currentRunningRunId = null;
    throw err;
  }
  activeRuns.set(runId, true);
  executePipeline(updatedRun, updatedRun.planVersion as PlanWithDetails).catch((err) => {
    logError('Pipeline execution failed (retry):', err);
    handlePipelineError(runId, err);
  });

  return updatedRun as Run;
}

// Cancel a run
export async function cancelRun(runId: string): Promise<void> {
  activeRuns.set(runId, false);

  await prisma.run.update({
    where: { id: runId },
    data: { status: 'canceled' },
  });

  broadcastRunUpdate(runId, { type: 'canceled' });
}

// Clear the render queue (for testing purposes)
export function clearRenderQueue(): void {
  renderQueue.length = 0;
  currentRunningRunId = null;
}

// Clear log queues (for testing purposes)
export function clearLogQueues(): void {
  logQueues.clear();
  logProcessing.clear();
}

// Export addLog for testing purposes
export async function addLogForTesting(
  runId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): Promise<void> {
  return addLog(runId, message, level);
}

// Helper functions
function isActive(runId: string): boolean {
  return activeRuns.get(runId) === true;
}

async function updateRun(runId: string, data: Partial<Run>) {
  await prisma.run.update({
    where: { id: runId },
    data,
  });

  broadcastRunUpdate(runId, { type: 'state', ...data });
}

async function updateStep(runId: string, step: string, message: string) {
  await prisma.run.update({
    where: { id: runId },
    data: { currentStep: step },
  });

  await addLog(runId, message);
  broadcastRunUpdate(runId, { type: 'step', step, message });
}

async function updateProgress(runId: string, progress: number) {
  await prisma.run.update({
    where: { id: runId },
    data: { progress },
  });

  broadcastRunUpdate(runId, { type: 'progress', progress });
}

// Queue infrastructure to prevent race conditions in log writes
interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

interface LogQueueItem {
  entry: LogEntry;
  resolve: () => void;
  reject: (error: Error) => void;
}

// Map of runId -> queue of pending log operations
const logQueues = new Map<string, LogQueueItem[]>();
// Map of runId -> promise for currently processing log operation
const logProcessing = new Map<string, Promise<void>>();

/**
 * Process the log queue for a specific run.
 * Ensures serial execution of log writes to prevent race conditions.
 */
async function processLogQueue(runId: string): Promise<void> {
  const queue = logQueues.get(runId);
  if (!queue || queue.length === 0) {
    logProcessing.delete(runId);
    return;
  }

  const item = queue.shift()!;

  try {
    // Read current logs
    const run = await prisma.run.findUnique({
      where: { id: runId },
    });

    if (!run) {
      const error = new Error(`Run ${runId} not found`);
      // Reject the current item
      item.reject(error);
      // Reject all remaining items in the queue to avoid leaving hanging promises
      while (queue.length > 0) {
        const queuedItem = queue.shift()!;
        queuedItem.reject(error);
      }
      // Mark processing as finished for this run
      logProcessing.delete(runId);
      return;
    }

    const logs = safeJsonParse<LogEntry[]>(run.logsJson, [], {
      runId: run.id,
      source: 'processLogQueue',
    });

    // Add new log entry
    logs.push(item.entry);

    // Write back to database
    await prisma.run.update({
      where: { id: runId },
      data: { logsJson: JSON.stringify(logs) },
    });

    // Broadcast the update
    broadcastRunUpdate(runId, {
      type: 'log',
      log: item.entry,
    });

    item.resolve();
  } catch (error) {
    const err = error as Error;
    // Reject the current item
    item.reject(err);
    // Reject all remaining items in the queue to avoid leaving hanging promises
    while (queue.length > 0) {
      const queuedItem = queue.shift()!;
      queuedItem.reject(err);
    }
    // Mark processing as finished for this run
    logProcessing.delete(runId);
    return;
  }

  // Process next item in queue
  if (queue.length > 0) {
    await processLogQueue(runId);
  } else {
    logProcessing.delete(runId);
  }
}

/**
 * Add a log entry to the run. Uses a queue to serialize writes and prevent race conditions.
 */
async function addLog(runId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    message,
    level,
  };

  return new Promise<void>((resolve, reject) => {
    // Get or create queue for this run
    if (!logQueues.has(runId)) {
      logQueues.set(runId, []);
    }

    const queue = logQueues.get(runId)!;
    queue.push({ entry, resolve, reject });

    // Start processing if not already running
    if (!logProcessing.has(runId)) {
      const processingPromise = processLogQueue(runId);
      logProcessing.set(runId, processingPromise);
    }
  });
}

async function saveResumeState(runId: string, state: Partial<ResumeState>) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) return;

  const currentState = safeJsonParse<ResumeState>(
    run.resumeStateJson,
    {},
    { runId: run.id, source: 'saveResumeState' }
  );

  const newState = { ...currentState, ...state };

  await prisma.run.update({
    where: { id: runId },
    data: { resumeStateJson: JSON.stringify(newState) },
  });
}
