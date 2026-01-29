import { prisma } from '../../db/client.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { env, getDryRunFailStep, getDryRunStepDelayMs, isRenderDryRun, isTestMode } from '../../env.js';
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

// Active runs for cancellation
const activeRuns = new Map<string, boolean>();

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

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'RENDERING' },
  });

  // Start pipeline in background with proper error handling
  activeRuns.set(runId, true);
  executePipeline(run, planVersion).catch(async (error) => {
    console.error('Pipeline execution failed:', error);
    // Update run status to failed if not already updated
    try {
      const currentRun = await prisma.run.findUnique({ where: { id: runId } });
      if (currentRun && currentRun.status === 'RENDERING') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const logs = JSON.parse(currentRun.logsJson);
        logs.push({
          timestamp: new Date().toISOString(),
          message: `Pipeline failed: ${errorMessage}`,
          level: 'error',
        });
        
        await prisma.run.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            logsJson: JSON.stringify(logs),
          },
        });
        
        // Broadcast failure to SSE clients
        broadcastRunUpdate(runId, {
          type: 'failed',
          error: errorMessage,
        });
      }
    } catch (updateError) {
      console.error('Failed to update run status after pipeline error:', updateError);
    }
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

  const resumeState = JSON.parse(run.resumeStateJson);
  let completedSteps = resumeState.completedSteps || [];
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
      
      for (let i = 0; i < scenes.length; i++) {
        if (!isActive(runId)) break;
        
        const scene = scenes[i];
        const audioPath = path.join(audioDir, `scene_${String(i).padStart(2, '0')}.mp3`);
        
        await addLog(runId, `Generating TTS for scene ${i + 1}/${scenes.length}...`);
        
        if (!fs.existsSync(audioPath)) {
          if (dryRun) {
            writePlaceholderFile(audioPath, `[dry-run audio]\n${scene.narrationText}\n`);
          } else {
            await generateTTS(scene.narrationText, audioPath, project.voicePreset);
          }
        }
        
        sceneAudioPaths.push(audioPath);
        
        // Update progress within step
        const stepProgress = ((i + 1) / scenes.length) * STEP_WEIGHTS.tts_generate;
        await updateProgress(runId, Math.round(stepProgress));
      }

      // Concatenate audio
      const voFullPath = path.join(audioDir, 'vo_full.mp3');
      if (sceneAudioPaths.length > 0 && !fs.existsSync(voFullPath)) {
        if (dryRun) {
          await addLog(runId, 'Creating dry-run voice-over placeholder...');
          writePlaceholderFile(
            voFullPath,
            `[dry-run voice-over]\n${scenes.map(s => s.narrationText).join('\n')}\n`
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
        const transcription = dryRun
          ? buildDryRunTranscription(scenes)
          : await transcribeAudio(voFullPath);
        fs.writeFileSync(timestampsPath, JSON.stringify(transcription, null, 2));
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
          ].filter(Boolean).join('. ');
          
          if (dryRun) {
            writePlaceholderFile(imagePath, `[dry-run image]\n${fullPrompt}\n`);
          } else {
            await generateImage(fullPrompt, imagePath, '1024x1792');
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
              scenes.map(s => ({
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
            scenes.map(s => ({
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
          const musicFiles = fs.readdirSync(env.MUSIC_LIBRARY_DIR)
            .filter(f => /\.(mp3|wav|m4a)$/i.test(f));
          
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
          await createSceneVideo(imagePath, scene.durationTargetSec, scene.effectPreset, videoPath);
        }
        
        if (fs.existsSync(videoPath)) {
          sceneVideoPaths.push(videoPath);
        }
        
        // Update progress
        const stepProgress = progress + ((i + 1) / scenes.length) * (STEP_WEIGHTS.ffmpeg_render * 0.5);
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
      
      if (!fs.existsSync(finalVideoPath) && fs.existsSync(rawVideoPath) && fs.existsSync(audioToUse)) {
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
      
      const finalVideoPath = path.join(finalDir, 'final.mp4');
      const thumbPath = path.join(finalDir, 'thumb.png');
      const exportPath = path.join(finalDir, 'export.json');
      
      // Extract thumbnail
      if (!dryRun && fs.existsSync(finalVideoPath) && !fs.existsSync(thumbPath)) {
        await addLog(runId, 'Extracting thumbnail...');
        await extractThumbnail(finalVideoPath, thumbPath, 2);
      }

      // Create export JSON
      if (!fs.existsSync(exportPath)) {
        const exportData = {
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
            scenes: scenes.map(s => ({
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
        
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      }

      if (!dryRun && fs.existsSync(thumbPath)) {
        artifacts.thumbPath = path.relative(env.ARTIFACTS_DIR, thumbPath);
      }
      artifacts.exportJsonPath = path.relative(env.ARTIFACTS_DIR, exportPath);
      
      completedSteps.push('finalize_artifacts');
      await saveResumeState(runId, { completedSteps });
      progress = 100;
      await updateProgress(runId, progress);
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
    console.error('Pipeline error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
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
  }
}

// Retry run from a specific step
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
  let resumeState = JSON.parse(run.resumeStateJson);
  
  if (fromStep) {
    const stepIndex = STEPS.indexOf(fromStep as RunStep);
    if (stepIndex >= 0) {
      resumeState.completedSteps = STEPS.slice(0, stepIndex);
    }
  } else {
    resumeState.completedSteps = [];
  }

  // Update run
  await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'queued',
      resumeStateJson: JSON.stringify(resumeState),
    },
  });

  const updatedRun = await prisma.run.findUnique({
    where: { id: runId },
  });

  // Start pipeline again
  activeRuns.set(runId, true);
  executePipeline(updatedRun!, run.planVersion as PlanWithDetails).catch(console.error);

  return updatedRun!;
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
  
  const logs = JSON.parse(run.logsJson);
  logs.push({
    timestamp: new Date().toISOString(),
    message,
    level,
  });
  
  await prisma.run.update({
    where: { id: runId },
    data: { logsJson: JSON.stringify(logs) },
  });
  
  broadcastRunUpdate(runId, { type: 'log', log: { timestamp: new Date().toISOString(), message, level } });
}

async function saveResumeState(runId: string, state: any) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });
  
  if (!run) return;
  
  const currentState = JSON.parse(run.resumeStateJson);
  const newState = { ...currentState, ...state };
  
  await prisma.run.update({
    where: { id: runId },
    data: { resumeStateJson: JSON.stringify(newState) },
  });
}
