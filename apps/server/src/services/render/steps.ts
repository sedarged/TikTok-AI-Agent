// Add missing method definition for mergeToFile in fluent-ffmpeg types if needed
// or just trust it works. It usually is .mergeToFile(fileName, tempDir?)
import { getOpenAI, isAIConfigured } from '../providers/openai';
import { getFFmpeg, generateSilence, generatePlaceholderImage, concatAudio } from '../ffmpeg';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Scene, Run } from '@prisma/client';
import { RenderPipeline } from '../render/pipeline'; // Circular dependency? Be careful.
// Actually RenderPipeline calls this.

// We will put logic in RenderPipeline directly or helper functions.
