import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../db/prisma.js';
import { env } from '../../env.js';
import { detectFfmpeg } from '../ffmpeg/bin.js';
import { getOpenAIClientOrThrow } from '../providers/openaiClient.js';
import { appendRunLog, setRunProgress, setRunStatus } from './logs.js';
import { getRunArtifacts, ensureArtifactsDirs } from './artifacts.js';
import { generateTtsSceneAudio } from '../audio/tts.js';
import { concatWavWithFfmpeg } from '../audio/concat.js';
import { transcribeWhisperVerbose } from '../audio/asr.js';
import { buildAssCaptions } from '../captions/ass.js';
import { buildMusicBed } from './music.js';
import { generateSceneImage } from './images.js';
import { concatSegments, extractThumbnail, renderFinalMp4, renderSceneSegment } from './ffmpegRender.js';
import { verifyRunArtifacts } from './verify.js';
import { getNichePackOrThrow } from '../plan/packs.js';

type StepId =
  | 'tts_generate'
  | 'asr_align'
  | 'images_generate'
  | 'captions_build'
  | 'music_build'
  | 'ffmpeg_render'
  | 'finalize_artifacts';

const STEPS: StepId[] = [
  'tts_generate',
  'asr_align',
  'images_generate',
  'captions_build',
  'music_build',
  'ffmpeg_render',
  'finalize_artifacts'
];

const stepBaseProgress: Record<StepId, number> = {
  tts_generate: 0,
  asr_align: 22,
  images_generate: 34,
  captions_build: 60,
  music_build: 68,
  ffmpeg_render: 72,
  finalize_artifacts: 95
};

class RenderEngine {
  private running = new Set<string>();

  async start(runId: string, resumeFromStep?: StepId | null) {
    if (this.running.has(runId)) return;
    this.running.add(runId);

    try {
      await this.runPipeline(runId, resumeFromStep ?? null);
    } catch (e: any) {
      try {
        await appendRunLog(runId, `Run failed: ${String(e?.message || e)}`);
        await setRunStatus(runId, 'failed');
        const run = await prisma.run.findUnique({ where: { id: runId } });
        if (run) await prisma.project.update({ where: { id: run.projectId }, data: { status: 'FAILED' } });
      } catch {}
    } finally {
      this.running.delete(runId);
    }
  }

  private async runPipeline(runId: string, resumeFromStep: StepId | null) {
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: { project: true, planVersion: { include: { scenes: { orderBy: { idx: 'asc' } } } } }
    });
    if (!run) throw new Error('Run not found.');

    const ff = detectFfmpeg();
    if (!ff.ffmpegPath || !ff.ffprobePath) {
      await setRunStatus(runId, 'failed');
      await appendRunLog(runId, 'Render blocked: FFmpeg/ffprobe not available (install system ffmpeg or use ffmpeg-static).');
      await prisma.project.update({ where: { id: run.projectId }, data: { status: 'FAILED' } });
      return;
    }
    if (!env.OPENAI_API_KEY) {
      await setRunStatus(runId, 'failed');
      await appendRunLog(runId, 'Render blocked: OPENAI_API_KEY is not configured. Rendering requires OpenAI (TTS, images, Whisper).');
      await prisma.project.update({ where: { id: run.projectId }, data: { status: 'FAILED' } });
      return;
    }

    const artifacts = getRunArtifacts(run.projectId, run.id);
    ensureArtifactsDirs(artifacts);

    await prisma.run.update({
      where: { id: runId },
      data: {
        artifactsJson: JSON.stringify({
          imagesDir: artifacts.imagesDir,
          audioDir: artifacts.audioDir,
          captionsPath: artifacts.captionsAssPath,
          mp4Path: artifacts.mp4Path,
          thumbPath: artifacts.thumbPath,
          exportJsonPath: artifacts.exportJsonPath
        })
      }
    });

    await setRunStatus(runId, 'running');
    await appendRunLog(runId, `Starting render run. ffmpeg=${ff.source}`);

    const client = getOpenAIClientOrThrow();

    const settings = run.project;
    const pack = await getNichePackOrThrow(settings.nichePackId);
    const scenes = run.planVersion.scenes;
    const voice = settings.voicePreset || 'alloy';

    const startStepIdx = resumeFromStep ? STEPS.indexOf(resumeFromStep) : 0;

    // 1) TTS per scene + concat
    if (startStepIdx <= STEPS.indexOf('tts_generate')) {
      await setRunProgress(runId, stepBaseProgress.tts_generate, 'tts_generate');
      await appendRunLog(runId, `TTS: generating ${scenes.length} scene audio files…`);

      const sceneAudioPaths: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        const out = path.join(artifacts.audioDir, `scene_${String(i + 1).padStart(2, '0')}.wav`);
        sceneAudioPaths.push(out);
        if (fs.existsSync(out)) {
          await appendRunLog(runId, `TTS: scene ${i + 1}/${scenes.length} already exists, reusing.`);
        } else {
          await appendRunLog(runId, `TTS: generating scene ${i + 1}/${scenes.length}…`);
          await generateTtsSceneAudio({ client, voice, text: s.narrationText, outPath: out });
        }
        const p = stepBaseProgress.tts_generate + ((i + 1) / scenes.length) * 22;
        await setRunProgress(runId, p, 'tts_generate');
      }

      if (!fs.existsSync(artifacts.voFullPath)) {
        await appendRunLog(runId, `TTS: concatenating into vo_full.wav…`);
        await concatWavWithFfmpeg({ ffmpegPath: ff.ffmpegPath, inputs: sceneAudioPaths, outPath: artifacts.voFullPath });
      } else {
        await appendRunLog(runId, `TTS: vo_full.wav already exists, reusing.`);
      }
    }

    // 2) ASR align
    if (startStepIdx <= STEPS.indexOf('asr_align')) {
      await setRunProgress(runId, stepBaseProgress.asr_align, 'asr_align');
      if (!fs.existsSync(artifacts.timestampsPath)) {
        await appendRunLog(runId, `ASR: transcribing vo_full.wav with Whisper…`);
        await transcribeWhisperVerbose({ client, audioPath: artifacts.voFullPath, outJsonPath: artifacts.timestampsPath });
      } else {
        await appendRunLog(runId, `ASR: timestamps.json already exists, reusing.`);
      }
      await setRunProgress(runId, stepBaseProgress.images_generate, 'images_generate');
    }

    // 3) Images
    if (startStepIdx <= STEPS.indexOf('images_generate')) {
      await appendRunLog(runId, `Images: generating ${scenes.length} images…`);
      const allowProceduralFallback = true;
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        const out = path.join(artifacts.imagesDir, `scene_${String(i + 1).padStart(2, '0')}.png`);
        if (fs.existsSync(out)) {
          await appendRunLog(runId, `Images: scene ${i + 1}/${scenes.length} already exists, reusing.`);
        } else {
          const prompt = [
            `STYLE_BIBLE: ${pack.config.styleBiblePrompt}`,
            settings.visualStylePreset ? `STYLE_PRESET: ${settings.visualStylePreset}` : null,
            `TOPIC: ${settings.title}`,
            `SCENE: ${s.visualPrompt}`,
            `NEGATIVE_GLOBAL: ${pack.config.globalNegativePrompt}`,
            `NEGATIVE_SCENE: ${s.negativePrompt}`
          ]
            .filter(Boolean)
            .join('\n');
          await appendRunLog(runId, `Images: generating scene ${i + 1}/${scenes.length}…`);
          const r = await generateSceneImage({
            client,
            prompt,
            outPath: out,
            allowProceduralFallback,
            proceduralText: s.onScreenText || settings.title
          });
          if (r.fallback) await appendRunLog(runId, `Images: OpenAI failed; used procedural fallback for scene ${i + 1}.`);
        }
        const p = stepBaseProgress.images_generate + ((i + 1) / scenes.length) * 26;
        await setRunProgress(runId, p, 'images_generate');
      }
    }

    // 4) Captions build
    if (startStepIdx <= STEPS.indexOf('captions_build')) {
      await setRunProgress(runId, stepBaseProgress.captions_build, 'captions_build');
      if (!fs.existsSync(artifacts.captionsAssPath)) {
        await appendRunLog(runId, `Captions: building captions.ass…`);
        // Minimal default caption style; pack-level style can be wired in later (packs stored in DB).
        buildAssCaptions({
          timestampsJsonPath: artifacts.timestampsPath,
          outAssPath: artifacts.captionsAssPath,
          style: pack.config.captionStyle,
          videoWidth: 1080,
          videoHeight: 1920
        });
      } else {
        await appendRunLog(runId, `Captions: captions.ass already exists, reusing.`);
      }
    }

    // 5) Music build (optional)
    const musicOut = path.join(artifacts.audioDir, 'music.wav');
    let musicPath: string | null = null;
    if (startStepIdx <= STEPS.indexOf('music_build')) {
      await setRunProgress(runId, stepBaseProgress.music_build, 'music_build');
      if (!fs.existsSync(musicOut)) {
        const r = await buildMusicBed({ ffmpegPath: ff.ffmpegPath, ffprobePath: ff.ffprobePath, voPath: artifacts.voFullPath, outPath: musicOut });
        if (r.used) {
          musicPath = musicOut;
          await appendRunLog(runId, `Music: using ${path.basename(r.musicPath!)}.`);
        } else {
          await appendRunLog(runId, `Music: skipped (${r.reason}).`);
        }
      } else {
        musicPath = musicOut;
        await appendRunLog(runId, `Music: music.wav already exists, reusing.`);
      }
    }

    // 6) FFmpeg render
    if (startStepIdx <= STEPS.indexOf('ffmpeg_render')) {
      await setRunProgress(runId, stepBaseProgress.ffmpeg_render, 'ffmpeg_render');
      const segmentsDir = path.join(artifacts.finalDir, 'segments');
      fs.mkdirSync(segmentsDir, { recursive: true });

      const segments: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const segPath = path.join(segmentsDir, `seg_${String(i + 1).padStart(2, '0')}.mp4`);
        segments.push(segPath);
        if (fs.existsSync(segPath)) {
          await appendRunLog(runId, `FFmpeg: segment ${i + 1}/${scenes.length} exists, reusing.`);
        } else {
          await appendRunLog(runId, `FFmpeg: rendering segment ${i + 1}/${scenes.length}…`);
          const img = path.join(artifacts.imagesDir, `scene_${String(i + 1).padStart(2, '0')}.png`);
          await renderSceneSegment({
            ffmpegPath: ff.ffmpegPath,
            imagePath: img,
            outPath: segPath,
            durationSec: scenes[i].durationTargetSec,
            effectPreset: scenes[i].effectPreset
          });
        }
        const p = stepBaseProgress.ffmpeg_render + ((i + 1) / scenes.length) * 20;
        await setRunProgress(runId, p, 'ffmpeg_render');
      }

      const joinedVideo = path.join(artifacts.finalDir, 'video_joined.mp4');
      if (!fs.existsSync(joinedVideo)) {
        await appendRunLog(runId, 'FFmpeg: concatenating segments…');
        await concatSegments({ ffmpegPath: ff.ffmpegPath, segmentPaths: segments, concatListPath: artifacts.concatListPath, outPath: joinedVideo });
      } else {
        await appendRunLog(runId, 'FFmpeg: joined video exists, reusing.');
      }

      if (!fs.existsSync(artifacts.mp4Path)) {
        await appendRunLog(runId, 'FFmpeg: rendering final MP4 (burn captions + mix audio)…');
        await renderFinalMp4({
          ffmpegPath: ff.ffmpegPath,
          inputVideoPath: joinedVideo,
          voAudioPath: artifacts.voFullPath,
          musicPath,
          captionsAssPath: artifacts.captionsAssPath,
          outMp4Path: artifacts.mp4Path
        });
      } else {
        await appendRunLog(runId, 'FFmpeg: final.mp4 exists, reusing.');
      }
    }

    // 7) Finalize artifacts (thumb + export json)
    if (startStepIdx <= STEPS.indexOf('finalize_artifacts')) {
      await setRunProgress(runId, stepBaseProgress.finalize_artifacts, 'finalize_artifacts');
      if (!fs.existsSync(artifacts.thumbPath) && fs.existsSync(artifacts.mp4Path)) {
        await appendRunLog(runId, 'Finalize: extracting thumbnail…');
        await extractThumbnail({ ffmpegPath: ff.ffmpegPath, mp4Path: artifacts.mp4Path, outPngPath: artifacts.thumbPath, atSec: 1 });
      }

      if (!fs.existsSync(artifacts.exportJsonPath)) {
        await appendRunLog(runId, 'Finalize: writing export.json…');
        const exportPayload = {
          project: run.project,
          planVersionId: run.planVersionId,
          runId: run.id,
          steps: STEPS,
          artifacts: {
            imagesDir: artifacts.imagesDir,
            audioDir: artifacts.audioDir,
            captionsPath: artifacts.captionsAssPath,
            timestampsPath: artifacts.timestampsPath,
            mp4Path: artifacts.mp4Path,
            thumbPath: artifacts.thumbPath
          }
        };
        fs.writeFileSync(artifacts.exportJsonPath, JSON.stringify(exportPayload, null, 2));
      }
    }

    await setRunProgress(runId, 100, null);
    const verify = await verifyRunArtifacts({
      expectedTargetLengthSec: run.project.targetLengthSec,
      voFullPath: artifacts.voFullPath,
      captionsAssPath: artifacts.captionsAssPath,
      mp4Path: artifacts.mp4Path,
      thumbPath: artifacts.thumbPath,
      exportJsonPath: artifacts.exportJsonPath,
      imagesDir: artifacts.imagesDir
    });

    if (!verify.pass) {
      await appendRunLog(runId, `Verification FAIL: ${verify.issues.join(' | ')}`);
      await setRunStatus(runId, 'failed');
      await prisma.project.update({ where: { id: run.projectId }, data: { status: 'FAILED' } });
      return;
    }

    await appendRunLog(runId, 'Verification PASS. Render complete.');
    await setRunStatus(runId, 'done');
    await prisma.project.update({ where: { id: run.projectId }, data: { status: 'DONE' } });
  }
}

export const renderEngine = new RenderEngine();
export type { StepId };

