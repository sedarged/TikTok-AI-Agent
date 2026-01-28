import { PrismaClient, Run, Project, PlanVersion, Scene } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { env } from '../../env';
import { isAIConfigured, generateSpeech, generateImage, transcribeAudio } from '../providers/openai';
import { generateSilence, generatePlaceholderImage, concatAudio, getFFmpeg } from '../ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

const prisma = new PrismaClient();

export type PipelineStep = 
  | 'tts_generate'
  | 'asr_align'
  | 'images_generate'
  | 'captions_build'
  | 'music_build'
  | 'ffmpeg_render'
  | 'finalize_artifacts';

export class RenderPipeline {
  private runId: string;
  private projectId: string;
  private artifactsDir: string;
  private imagesDir: string;
  private audioDir: string;
  private captionsDir: string;
  private finalDir: string;

  constructor(runId: string, projectId: string) {
    this.runId = runId;
    this.projectId = projectId;
    this.artifactsDir = path.join(env.ARTIFACTS_DIR, projectId, runId);
    this.imagesDir = path.join(this.artifactsDir, 'images');
    this.audioDir = path.join(this.artifactsDir, 'audio');
    this.captionsDir = path.join(this.artifactsDir, 'captions');
    this.finalDir = path.join(this.artifactsDir, 'final');
  }

  async initialize() {
    await fs.mkdir(this.artifactsDir, { recursive: true });
    await fs.mkdir(this.imagesDir, { recursive: true });
    await fs.mkdir(this.audioDir, { recursive: true });
    await fs.mkdir(this.captionsDir, { recursive: true });
    await fs.mkdir(this.finalDir, { recursive: true });
    
    await prisma.run.update({
      where: { id: this.runId },
      data: {
        artifactsJson: JSON.stringify({
          imagesDir: 'images',
          audioDir: 'audio',
          captionsPath: 'captions/captions.ass',
          mp4Path: 'final/final.mp4',
          thumbPath: 'final/thumb.png',
          exportJsonPath: 'export.json'
        })
      }
    });
  }

  async execute() {
    try {
      await this.initialize();
      
      const run = await prisma.run.findUnique({ where: { id: this.runId }, include: { planVersion: { include: { scenes: { orderBy: { idx: 'asc' } } } }, project: true } });
      if (!run) throw new Error('Run not found');

      const { planVersion, project } = run;
      const scenes = planVersion.scenes;

      await this.log('Starting render pipeline...');

      // 1. TTS
      await this.updateStep('tts_generate');
      await this.stepTTS(scenes, project.voicePreset);

      // 2. ASR
      await this.updateStep('asr_align');
      await this.stepASR();

      // 3. Images
      await this.updateStep('images_generate');
      await this.stepImages(scenes, project.nichePackId);

      // 4. Captions
      await this.updateStep('captions_build');
      await this.stepCaptions(scenes, project.nichePackId);

      // 5. Music
      await this.updateStep('music_build');
      await this.stepMusic();

      // 6. FFmpeg
      await this.updateStep('ffmpeg_render');
      await this.stepFFmpeg(scenes);

      // 7. Finalize
      await this.updateStep('finalize_artifacts');
      await this.stepFinalize(run, scenes);

      await prisma.run.update({
        where: { id: this.runId },
        data: { status: 'done', progress: 100 }
      });
      
      await prisma.project.update({
        where: { id: this.projectId },
        data: { status: 'DONE' }
      });

      await this.log('Render complete!');

    } catch (error: any) {
      console.error('Pipeline failed:', error);
      await this.log(`Pipeline failed: ${error.message}`);
      await prisma.run.update({
        where: { id: this.runId },
        data: { status: 'failed' }
      });
    }
  }

  private async stepTTS(scenes: Scene[], voicePreset: string) {
    await this.log('Generating TTS audio...');
    const audioFiles: string[] = [];
    
    for (const scene of scenes) {
        const outputPath = path.join(this.audioDir, `scene_${scene.idx}.mp3`);
        audioFiles.push(outputPath);

        if (isAIConfigured()) {
            await this.log(`Generating speech for scene ${scene.idx}...`);
            const mapVoice = (p: string) => {
                if (p === 'en_us_001') return 'nova';
                if (p === 'en_us_006') return 'onyx';
                if (p === 'en_us_002') return 'echo';
                return 'alloy';
            };
            await generateSpeech(scene.narrationText, mapVoice(voicePreset), outputPath);
        } else {
            await this.log(`Generating silence (mock) for scene ${scene.idx}...`);
            await generateSilence(scene.durationTargetSec, outputPath);
        }
    }
    
    // Concatenate for full VO
    if (audioFiles.length > 0) {
        await concatAudio(audioFiles, path.join(this.audioDir, 'vo_full.mp3'));
    }
    
    await this.setProgress(15);
  }

  private async stepASR() {
    await this.log('Aligning audio (ASR)...');
    const audioPath = path.join(this.audioDir, 'vo_full.mp3');
    
    if (isAIConfigured() && existsSync(audioPath)) {
        await this.log('Running Whisper transcription...');
        const result = await transcribeAudio(audioPath);
        await fs.writeFile(path.join(this.captionsDir, 'timestamps.json'), JSON.stringify(result, null, 2));
    } else {
        await this.log('Skipping ASR (AI not configured), using naive alignment...');
        await fs.writeFile(path.join(this.captionsDir, 'timestamps.json'), '{}');
    }
    await this.setProgress(25);
  }

  private async stepImages(scenes: Scene[], packId: string) {
    await this.log('Generating images...');
    
    for (const scene of scenes) {
        const outputPath = path.join(this.imagesDir, `scene_${scene.idx}.png`);
        
        if (existsSync(outputPath)) continue;

        if (isAIConfigured()) {
             await this.log(`Generating AI image for scene ${scene.idx}...`);
             await generateImage(`${scene.visualPrompt}, vertical aspect ratio`, outputPath);
        } else {
             await this.log(`Generating placeholder image for scene ${scene.idx}...`);
             const colors = ['red', 'blue', 'green', 'purple', 'orange', 'black'];
             const color = colors[scene.idx % colors.length];
             await generatePlaceholderImage(`Scene ${scene.idx}`, color, outputPath);
        }
    }
    await this.setProgress(50);
  }

  private async stepCaptions(scenes: Scene[], packId: string) {
    await this.log('Building captions...');
    
    const timestampsPath = path.join(this.captionsDir, 'timestamps.json');
    let wordsData: any[] = [];
    
    try {
        const data = await fs.readFile(timestampsPath, 'utf-8');
        const json = JSON.parse(data);
        if (json.words) {
            wordsData = json.words;
        }
    } catch (e) {
        console.warn('Failed to read timestamps, defaulting to naive');
    }

    let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,1,3,0,2,10,10,200,1
Style: Highlight,Arial,60,&H0000FFFF,&H000000FF,&H00000000,&H00000000,1,0,1,3,0,2,10,10,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const formatTime = (t: number) => {
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        const cs = Math.floor((t % 1) * 100);
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
    };

    if (wordsData.length > 0) {
        let chunk: any[] = [];
        let chunkStart = wordsData[0].start;
        let chunkEnd = wordsData[0].end;
        
        for (let i = 0; i < wordsData.length; i++) {
            const word = wordsData[i];
            chunk.push(word);
            chunkEnd = word.end;
            
            const isPause = (i < wordsData.length - 1) && (wordsData[i+1].start - word.end > 0.5);
            
            if (chunk.length >= 4 || isPause || i === wordsData.length - 1) {
                const text = chunk.map(w => w.word).join(' ');
                assContent += `Dialogue: 0,${formatTime(chunkStart)},${formatTime(chunkEnd)},Default,,0,0,0,,${text}\n`;
                chunk = [];
                if (i < wordsData.length - 1) {
                    chunkStart = wordsData[i+1].start;
                }
            }
        }
    } else {
        let currentTime = 0;
        for (const scene of scenes) {
            const duration = scene.durationTargetSec;
            const endTime = currentTime + duration;
            const words = scene.narrationText.split(' ');
            const chunkDuration = duration / Math.max(1, Math.ceil(words.length / 5)); 
            
            let chunkStartTime = currentTime;
            let currentChunkWords: string[] = [];
            
            for (let i = 0; i < words.length; i++) {
                currentChunkWords.push(words[i]);
                if (currentChunkWords.length >= 5 || i === words.length - 1) {
                    const chunkEndTime = Math.min(chunkStartTime + chunkDuration, endTime);
                    const text = currentChunkWords.join(' ');
                    assContent += `Dialogue: 0,${formatTime(chunkStartTime)},${formatTime(chunkEndTime)},Default,,0,0,0,,${text}\n`;
                    chunkStartTime = chunkEndTime;
                    currentChunkWords = [];
                }
            }
            currentTime = endTime;
        }
    }

    await fs.writeFile(path.join(this.captionsDir, 'captions.ass'), assContent);
    await this.setProgress(60);
  }

  private async stepMusic() {
    await this.log('Mixing music (Skipped for MVP)...');
    await this.setProgress(70);
  }

  private async stepFFmpeg(scenes: Scene[]) {
    await this.log('Rendering video with FFmpeg...');
    const outputPath = path.join(this.finalDir, 'final.mp4');
    const audioPath = path.join(this.audioDir, 'vo_full.mp3');
    const assPath = path.join(this.captionsDir, 'captions.ass');

    const segmentFiles: string[] = [];

    for (const scene of scenes) {
        const imgPath = path.join(this.imagesDir, `scene_${scene.idx}.png`);
        const sceneAudioPath = path.join(this.audioDir, `scene_${scene.idx}.mp3`);
        const segPath = path.join(this.artifactsDir, `seg_${scene.idx}.mp4`);
        
        await this.log(`Rendering segment ${scene.idx}...`);

        const frames = Math.ceil(scene.durationTargetSec * 30); // 30fps

        await new Promise<void>((resolve, reject) => {
            getFFmpeg()
                .input(imgPath)
                .loop(scene.durationTargetSec)
                .input(sceneAudioPath)
                .complexFilter([
                    `zoompan=z='min(zoom+0.0015,1.5)':d=${frames}:s=1080x1920:fps=30`
                ])
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-shortest',
                    '-t', scene.durationTargetSec.toString()
                ])
                .output(segPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
        
        segmentFiles.push(segPath);
    }

    const listPath = path.join(this.artifactsDir, 'segments.txt');
    const listContent = segmentFiles.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(listPath, listContent);

    await this.log('Concatenating segments and burning subtitles...');
    
    await new Promise<void>((resolve, reject) => {
        getFFmpeg()
            .input(listPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                `-vf subtitles=${assPath}`
            ])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });

    await this.setProgress(90);
  }

  private async stepFinalize(run: Run, scenes: Scene[]) {
    await this.log('Finalizing artifacts...');
    
    const videoPath = path.join(this.finalDir, 'final.mp4');
    
    await new Promise<void>((resolve, reject) => {
        getFFmpeg()
            .input(videoPath)
            .screenshots({
                count: 1,
                timemarks: ['1'],
                folder: this.finalDir,
                filename: 'thumb.png',
                size: '1080x1920'
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });

    const exportData = {
      runId: run.id,
      projectId: run.projectId,
      plan: run.planVersionId,
      scenes: scenes.map(s => ({ idx: s.idx, prompt: s.visualPrompt }))
    };
    await fs.writeFile(path.join(this.artifactsDir, 'export.json'), JSON.stringify(exportData, null, 2));
    await this.setProgress(100);
  }

  private async updateStep(step: PipelineStep) {
    await prisma.run.update({
      where: { id: this.runId },
      data: { currentStep: step }
    });
  }

  private async setProgress(progress: number) {
    await prisma.run.update({
      where: { id: this.runId },
      data: { progress }
    });
  }

  private async log(message: string) {
    const entry = { ts: new Date().toISOString(), msg: message };
    const run = await prisma.run.findUnique({ where: { id: this.runId }, select: { logsJson: true } });
    const logs = run?.logsJson ? JSON.parse(run.logsJson) : [];
    logs.push(entry);
    
    await prisma.run.update({
      where: { id: this.runId },
      data: { logsJson: JSON.stringify(logs) }
    });
  }
}

export async function startRender(projectId: string, planVersionId: string) {
  const run = await prisma.run.create({
    data: {
      projectId,
      planVersionId,
      status: 'queued',
      progress: 0,
      logsJson: '[]'
    }
  });

  const pipeline = new RenderPipeline(run.id, projectId);
  pipeline.execute();

  return run;
}
