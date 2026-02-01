import { prisma } from '../../db/client.js';
import { logError, logWarn } from '../../utils/logger.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
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

interface ResumeState {
  completedSteps?: RunStep[];
  completedSceneIdxs?: number[];
}

// Active runs for cancellation
const activeRuns = new Map<string, boolean>();

// Queue: max 1 render at a time; runIds waiting to start
const renderQueue: string[] = [];
let currentRunningRunId: string | null = null;

async function processNextInQueue(): Promise<void> {
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
    if (!run || run.status !== 'queued') return;
    currentRunningRunId = runId;
    await prisma.project.update({
      where: { id: run.projectId },
      data: { status: 'RENDERING' },
    });
    activeRuns.set(runId, true);
    executePipeline(run, run.planVersion as PlanWithDetails).catch((err) => {
      logError('Pipeline execution failed (from queue):', err);
      handlePipelineError(runId, err);
    });
  } catch (err) {
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
      let logs: Array<{ timestamp: string; message: string; level: string }>;
      try {
        logs = JSON.parse(currentRun.logsJson);
      } catch {
        logs = [];
      }
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
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'RENDERING' },
  });
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
  const artifacts: Record<string, string | boolean> = {
    imagesDir: path.relative(env.ARTIFACTS_DIR, imagesDir),
    audioDir: path.relative(env.ARTIFACTS_DIR, audioDir),
    captionsDir: path.relative(env.ARTIFACTS_DIR, captionsDir),
    dryRun,
  };

  let totalCostUsd = 0;
  let resumeState;
  try {
    resumeState = JSON.parse(run.resumeStateJson);
  } catch (error) {
    logError('Failed to parse resumeStateJson, starting fresh:', error);
    resumeState = { completedSteps: [], completedSceneIdxs: [] };
  }

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
            logWarn(`Failed to get audio duration for scene ${i}, using target duration:`, error);
          }
        }
        sceneAudioDurations.push(audioDuration);

        // Update progress within step
        const stepProgress = ((i + 1) / scenes.length) * STEP_WEIGHTS.tts_generate;
        await updateProgress(runId, Math.round(stepProgress));
      }

      // Update scene durations and recalculate timings based on measured audio
      // Note: This will always execute if any scenes exist, as we push a duration for each scene above
      if (sceneAudioDurations.length > 0) {
        await addLog(runId, 'Updating scene durations based on audio...');
        let currentTime = 0;
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          const newDuration = sceneAudioDurations[i];
          const newEndTime = currentTime + newDuration;

          await prisma.scene.update({
            where: { id: scene.id },
            data: {
              durationTargetSec: newDuration,
              startTimeSec: currentTime,
              endTimeSec: newEndTime,
            },
          });

          // Update local scene object for subsequent steps
          scene.durationTargetSec = newDuration;
          scene.startTimeSec = currentTime;
          scene.endTimeSec = newEndTime;

          currentTime = newEndTime;
        }
        await addLog(runId, `Updated ${scenes.length} scene(s) with measured audio durations`);
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

    // Step 3: Generate Images
    if (!completedSteps.includes('images_generate') && isActive(runId)) {
      if (await delayOrCancel('images_generate', runId)) {
        return;
      }

      if (shouldFailStep('images_generate')) {
        throw new Error('Dry-run failure injected at images_generate');
      }

      await updateStep(runId, 'images_generate', 'Generating scene images...');

      const pack = getNichePack(project.nichePackId);

      for (let i = 0; i < scenes.length; i++) {
        if (!isActive(runId)) break;

        const scene = scenes[i];
        const imagePath = path.join(imagesDir, `scene_${String(i).padStart(2, '0')}.png`);

        if (!fs.existsSync(imagePath)) {
          await addLog(runId, `Generating image for scene ${i + 1}/${scenes.length}...`);

          // Build full prompt
          const fullPrompt = [
            pack?.styleBiblePrompt || '',
            scene.visualPrompt,
            'High quality, detailed, vertical composition suitable for TikTok',
          ]
            .filter(Boolean)
            .join('. ');

          if (dryRun) {
            writePlaceholderFile(imagePath, `[dry-run image]\n${fullPrompt}\n`);
          } else {
            const imgResult = await generateImage(fullPrompt, imagePath, '1024x1792');
            totalCostUsd += imgResult.estimatedCostUsd;
          }
        }

        // Update progress
        const stepProgress = progress + ((i + 1) / scenes.length) * STEP_WEIGHTS.images_generate;
        await updateProgress(runId, Math.round(stepProgress));
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
          const transcription = JSON.parse(fs.readFileSync(timestampsPath, 'utf-8'));

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

      (artifacts as Record<string, unknown>).costEstimate = {
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
        (artifacts as Record<string, unknown>).thumbPaths = thumbPaths;
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
          (artifacts as Record<string, unknown>).tiktokCaption = tiktokCaption;
          (artifacts as Record<string, unknown>).tiktokHashtags = tiktokHashtags;
          (artifacts as Record<string, unknown>).tiktokTitle = tiktokTitle;
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
        (artifacts as Record<string, unknown>).qaResult = qaResult.qaResult;
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

    (artifacts as Record<string, unknown>).costEstimate = {
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
    if (currentRunningRunId === runId) {
      currentRunningRunId = null;
      processNextInQueue().catch((err) => logError('Error processing next in queue', err));
    }
  }
}

// Reset runs stuck in 'running' after server restart (no in-memory activeRuns)
export async function resetStuckRuns(): Promise<void> {
  const stuck = await prisma.run.findMany({
    where: { status: 'running' },
    select: { id: true, projectId: true, logsJson: true },
  });
  for (const run of stuck) {
    let logs: Array<{ timestamp: string; message: string; level: string }>;
    try {
      logs = JSON.parse(run.logsJson);
    } catch {
      logs = [];
    }
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
  let resumeState: { completedSteps?: RunStep[] };
  try {
    resumeState = JSON.parse(run.resumeStateJson);
  } catch {
    resumeState = {};
  }
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
  await prisma.project.update({
    where: { id: updatedRun.projectId },
    data: { status: 'RENDERING' },
  });
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

async function addLog(runId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) return;

  let logs;
  try {
    logs = JSON.parse(run.logsJson);
  } catch (error) {
    logError('Failed to parse logsJson, starting fresh:', error);
    logs = [];
  }

  logs.push({
    timestamp: new Date().toISOString(),
    message,
    level,
  });

  await prisma.run.update({
    where: { id: runId },
    data: { logsJson: JSON.stringify(logs) },
  });

  broadcastRunUpdate(runId, {
    type: 'log',
    log: { timestamp: new Date().toISOString(), message, level },
  });
}

async function saveResumeState(runId: string, state: Partial<ResumeState>) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) return;

  let currentState;
  try {
    currentState = JSON.parse(run.resumeStateJson);
  } catch (error) {
    logError('Failed to parse resumeStateJson, starting fresh:', error);
    currentState = {};
  }

  const newState = { ...currentState, ...state };

  await prisma.run.update({
    where: { id: runId },
    data: { resumeStateJson: JSON.stringify(newState) },
  });
}
