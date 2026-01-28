import fs from "fs/promises";
import path from "path";
import { prisma } from "../../db/client.js";
import { config, providerStatus } from "../../env.js";
import { appendRunLog, markRunStatus, updateRunProgress } from "./runLog.js";
import { generateTts, ensureDir, sceneAudioPath } from "../audio/tts.js";
import { transcribeAudio } from "../audio/asr.js";
import { generateImageCached } from "./imageGenerator.js";
import { buildAssCaptions } from "../captions/assBuilder.js";
import { mixVoiceWithMusic, pickMusicTrack } from "../audio/music.js";
import { createImageSegment } from "../ffmpeg/videoSegments.js";
import { concatWithTransitions } from "../ffmpeg/concat.js";
import { getFfmpegPath, getFfprobePath } from "../ffmpeg/ffmpegPath.js";
import { runCommand, runCommandCapture } from "../ffmpeg/exec.js";
import { getNichePack } from "../plan/nichePacks.js";

type ResumeState = {
  lastCompletedStep?: string;
  completedSceneIdxs?: number[];
};

const STEPS = [
  "tts_generate",
  "asr_align",
  "images_generate",
  "captions_build",
  "music_build",
  "ffmpeg_render",
  "finalize_artifacts"
];

function stepIdxProgress(stepIdx: number, completed: number, total: number, span: number) {
  const base = stepIdx * span;
  const fraction = total > 0 ? completed / total : 1;
  return Math.min(99, base + span * fraction);
}

async function ensureRunDirs(projectId: string, runId: string) {
  const baseDir = path.join(config.artifactsDir, projectId, runId);
  const imagesDir = path.join(baseDir, "images");
  const audioDir = path.join(baseDir, "audio");
  const captionsDir = path.join(baseDir, "captions");
  const finalDir = path.join(baseDir, "final");
  await Promise.all([
    ensureDir(imagesDir),
    ensureDir(audioDir),
    ensureDir(captionsDir),
    ensureDir(finalDir)
  ]);
  return { baseDir, imagesDir, audioDir, captionsDir, finalDir };
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function updateResume(runId: string, partial: ResumeState) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  const current = (run?.resumeStateJson as ResumeState) ?? {};
  const updated = { ...current, ...partial };
  await prisma.run.update({ where: { id: runId }, data: { resumeStateJson: updated } });
}

async function markStepComplete(runId: string, step: string) {
  await updateResume(runId, { lastCompletedStep: step });
}

export async function runPipeline(runId: string, resumeFromStep?: string) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found.");

  const project = await prisma.project.findUnique({ where: { id: run.projectId } });
  if (!project) throw new Error("Project not found.");
  const plan = await prisma.planVersion.findUnique({ where: { id: run.planVersionId } });
  if (!plan) throw new Error("Plan not found.");
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const pack = await getNichePack(project.nichePackId);
  if (!pack) throw new Error("Niche pack not found.");

  const resumeState = (run.resumeStateJson as ResumeState) ?? {};
  const completedSceneIdxs = new Set<number>(resumeState.completedSceneIdxs ?? []);
  const startIndex = resumeFromStep
    ? Math.max(0, STEPS.indexOf(resumeFromStep))
    : resumeState.lastCompletedStep
    ? Math.max(0, STEPS.indexOf(resumeState.lastCompletedStep) + 1)
    : 0;

  await markRunStatus(runId, "running");
  await updateRunProgress(runId, 2, "queued");
  await appendRunLog(runId, "Starting render pipeline.");

  const { imagesDir, audioDir, captionsDir, finalDir } = await ensureRunDirs(
    project.id,
    runId
  );

  const stepCount = STEPS.length;
  const stepSpan = 100 / stepCount;
  const stepProgress = (stepIdx: number) => Math.min(99, Math.round(((stepIdx + 1) / stepCount) * 100));

  for (let i = startIndex; i < STEPS.length; i += 1) {
    const step = STEPS[i];
    await updateRunProgress(runId, stepProgress(i), step);

    if (step === "tts_generate") {
      await providerGuard();
      await appendRunLog(runId, "Generating per-scene TTS audio.");
      for (const scene of scenes) {
        const audioPath = sceneAudioPath(audioDir, scene.idx);
        if (await fileExists(audioPath)) {
          await appendRunLog(runId, `Scene ${scene.idx + 1} audio already exists, skipping.`);
          completedSceneIdxs.add(scene.idx);
          await updateResume(runId, {
            completedSceneIdxs: Array.from(completedSceneIdxs)
          });
          continue;
        }
        await appendRunLog(runId, `Generating TTS for scene ${scene.idx + 1}/${scenes.length}.`);
        await generateTts({
          text: scene.narrationText,
          voicePreset: project.voicePreset,
          outputPath: audioPath
        });
        completedSceneIdxs.add(scene.idx);
        await updateResume(runId, {
          completedSceneIdxs: Array.from(completedSceneIdxs)
        });
        const sceneProgress = Math.round(stepIdxProgress(i, scene.idx + 1, scenes.length, stepSpan));
        await updateRunProgress(runId, sceneProgress, step);
      }
      const fullVoice = path.join(audioDir, "vo_full.wav");
      if (!(await fileExists(fullVoice))) {
        const concatList = scenes
          .map((scene) => `file '${sceneAudioPath(audioDir, scene.idx)}'`)
          .join("\n");
        const listPath = path.join(audioDir, "concat.txt");
        await fs.writeFile(listPath, concatList, "utf8");
        const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
        await runCommand(
          ffmpegPath,
          ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", fullVoice],
          "ffmpeg concat audio"
        );
      }
      await markStepComplete(runId, step);
    }

    if (step === "asr_align") {
      await providerGuard();
      await appendRunLog(runId, "Aligning audio with Whisper.");
      const fullVoice = path.join(audioDir, "vo_full.wav");
      const timestampsPath = path.join(captionsDir, "timestamps.json");
      if (!(await fileExists(timestampsPath))) {
        await transcribeAudio({ audioPath: fullVoice, outputPath: timestampsPath });
      }
      await markStepComplete(runId, step);
    }

    if (step === "images_generate") {
      await providerGuard();
      await appendRunLog(runId, "Generating AI images for scenes.");
      for (const scene of scenes) {
        const imagePath = path.join(imagesDir, `scene_${String(scene.idx + 1).padStart(2, "0")}.png`);
        if (await fileExists(imagePath)) {
          await appendRunLog(runId, `Scene ${scene.idx + 1} image exists, skipping.`);
          completedSceneIdxs.add(scene.idx);
          await updateResume(runId, {
            completedSceneIdxs: Array.from(completedSceneIdxs)
          });
          continue;
        }
        const styleHint = project.visualStylePreset ? `Style: ${project.visualStylePreset}.` : "";
        const prompt = `${pack.styleBiblePrompt} ${styleHint} ${scene.visualPrompt}. Negative: ${pack.globalNegativePrompt} ${scene.negativePrompt}`;
        await appendRunLog(runId, `Generating image for scene ${scene.idx + 1}/${scenes.length}.`);
        await generateImageCached({ prompt, outputPath: imagePath });
        completedSceneIdxs.add(scene.idx);
        await updateResume(runId, {
          completedSceneIdxs: Array.from(completedSceneIdxs)
        });
        const sceneProgress = Math.round(stepIdxProgress(i, scene.idx + 1, scenes.length, stepSpan));
        await updateRunProgress(runId, sceneProgress, step);
      }
      await markStepComplete(runId, step);
    }

    if (step === "captions_build") {
      await appendRunLog(runId, "Building captions.ass file.");
      const timestampsPath = path.join(captionsDir, "timestamps.json");
      const captionsPath = path.join(captionsDir, "captions.ass");
      if (!(await fileExists(captionsPath))) {
        const raw = await fs.readFile(timestampsPath, "utf8");
        const transcription = JSON.parse(raw);
        await buildAssCaptions({
          transcription,
          style: pack.captionStyle,
          outputPath: captionsPath
        });
      }
      await markStepComplete(runId, step);
    }

    if (step === "music_build") {
      const mixedPath = path.join(audioDir, "vo_music.m4a");
      if (!(await fileExists(mixedPath))) {
        const musicTrack = await pickMusicTrack();
        if (musicTrack) {
          await appendRunLog(runId, "Mixing background music.");
          await mixVoiceWithMusic({
            voicePath: path.join(audioDir, "vo_full.wav"),
            musicPath: musicTrack,
            outputPath: mixedPath
          });
        } else {
          await appendRunLog(runId, "No music library found, skipping music mix.");
        }
      }
      await markStepComplete(runId, step);
    }

    if (step === "ffmpeg_render") {
      const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
      try {
        await runCommand(ffmpegPath, ["-version"], "ffmpeg check");
      } catch {
        throw new Error("FFmpeg not available. Install ffmpeg or add ffmpeg-static.");
      }
      await appendRunLog(runId, "Rendering video segments.");
      const segmentPaths: string[] = [];
      for (const scene of scenes) {
        const segmentPath = path.join(finalDir, `segment_${String(scene.idx + 1).padStart(2, "0")}.mp4`);
        segmentPaths.push(segmentPath);
        if (await fileExists(segmentPath)) {
          continue;
        }
        const imagePath = path.join(imagesDir, `scene_${String(scene.idx + 1).padStart(2, "0")}.png`);
        await createImageSegment({
          imagePath,
          outputPath: segmentPath,
          durationSec: scene.durationTargetSec,
          effect: scene.effectPreset as any
        });
      }
      const concatPath = path.join(finalDir, "video_base.mp4");
      if (!(await fileExists(concatPath))) {
        if (segmentPaths.length === 1) {
          await fs.copyFile(segmentPaths[0], concatPath);
        } else {
          await concatWithTransitions({
            segmentPaths,
            durations: scenes.map((scene) => scene.durationTargetSec),
            outputPath: concatPath
          });
        }
      }

      const captionsPath = path.join(captionsDir, "captions.ass");
      const audioPath = (await fileExists(path.join(audioDir, "vo_music.m4a")))
        ? path.join(audioDir, "vo_music.m4a")
        : path.join(audioDir, "vo_full.wav");

      const finalMp4 = path.join(finalDir, "final.mp4");
      if (!(await fileExists(finalMp4))) {
        await runCommand(
          ffmpegPath,
          [
            "-y",
            "-i",
            concatPath,
            "-i",
            audioPath,
            "-vf",
            `ass=${captionsPath}`,
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-shortest",
            finalMp4
          ],
          "ffmpeg final render"
        );
      }
      await markStepComplete(runId, step);
    }

    if (step === "finalize_artifacts") {
      const finalMp4 = path.join(finalDir, "final.mp4");
      const thumbPath = path.join(finalDir, "thumb.png");
      if (!(await fileExists(thumbPath))) {
        const ffmpegPath = getFfmpegPath() ?? "ffmpeg";
        await runCommand(
          ffmpegPath,
          ["-y", "-i", finalMp4, "-vf", "thumbnail,scale=1080:1920", "-frames:v", "1", thumbPath],
          "ffmpeg thumbnail"
        );
      }
      const exportPath = path.join(finalDir, "export.json");
      const artifactsJson = {
        imagesDir,
        audioDir,
        captionsPath: path.join(captionsDir, "captions.ass"),
        mp4Path: finalMp4,
        thumbPath,
        exportJsonPath: exportPath
      };
      if (!(await fileExists(exportPath))) {
        await fs.writeFile(
          exportPath,
          JSON.stringify(
            {
              project,
              plan,
              scenes,
              run,
              artifacts: artifactsJson
            },
            null,
            2
          ),
          "utf8"
        );
      }
      await prisma.run.update({
        where: { id: runId },
        data: {
          artifactsJson
        }
      });
      await markStepComplete(runId, step);
    }
  }

  await updateRunProgress(runId, 100, "done");
  await markRunStatus(runId, "done");
  await appendRunLog(runId, "Render pipeline complete.");
}

export async function verifyRunArtifacts(runId: string) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found.");
  const plan = await prisma.planVersion.findUnique({ where: { id: run.planVersionId } });
  if (!plan) throw new Error("Plan not found.");
  const scenes = await prisma.scene.findMany({
    where: { planVersionId: plan.id },
    orderBy: { idx: "asc" }
  });
  const artifacts = run.artifactsJson as {
    imagesDir?: string;
    audioDir?: string;
    captionsPath?: string;
    mp4Path?: string;
    thumbPath?: string;
    exportJsonPath?: string;
  };
  const issues: string[] = [];
  const requiredFiles = [
    artifacts?.captionsPath,
    artifacts?.mp4Path,
    artifacts?.thumbPath,
    artifacts?.exportJsonPath
  ].filter(Boolean) as string[];

  for (const file of requiredFiles) {
    if (!(await fileExists(file))) {
      issues.push(`Missing file: ${file}`);
    }
  }
  if (artifacts?.imagesDir) {
    for (const scene of scenes) {
      const imgPath = path.join(
        artifacts.imagesDir,
        `scene_${String(scene.idx + 1).padStart(2, "0")}.png`
      );
      if (!(await fileExists(imgPath))) {
        issues.push(`Missing image for scene ${scene.idx + 1}`);
      }
    }
  }
  if (artifacts?.audioDir) {
    const voicePath = path.join(artifacts.audioDir, "vo_full.wav");
    if (!(await fileExists(voicePath))) {
      issues.push("Missing concatenated voice audio.");
    }
  }
  if (artifacts?.mp4Path && (await fileExists(artifacts.mp4Path))) {
    const ffprobePath = getFfprobePath() ?? "ffprobe";
    try {
      const output = await runCommandCapture(
        ffprobePath,
        ["-v", "error", "-show_entries", "format=duration", "-of", "json", artifacts.mp4Path],
        "ffprobe"
      );
      const parsed = JSON.parse(output);
      const duration = Number(parsed?.format?.duration ?? 0);
      const target = scenes.reduce((sum, scene) => sum + scene.durationTargetSec, 0);
      const tolerance = target >= 180 ? 5 : 3;
      if (Math.abs(duration - target) > tolerance) {
        issues.push(`Duration mismatch. Expected ~${target}s, got ${duration.toFixed(2)}s.`);
      }
    } catch (error) {
      issues.push(`ffprobe failed: ${(error as Error).message}`);
    }
  }

  return {
    status: issues.length ? "FAIL" : "PASS",
    issues
  };
}

export async function providerGuard() {
  if (!providerStatus.openaiConfigured) {
    throw new Error("OpenAI API key is missing. Configure OPENAI_API_KEY to render.");
  }
}
