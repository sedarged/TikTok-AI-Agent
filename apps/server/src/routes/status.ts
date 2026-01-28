import { Router } from 'express';
import { getProviderStatus, isOpenAIConfigured, isElevenLabsConfigured } from '../env.js';
import { checkFFmpegAvailable } from '../services/ffmpeg/ffmpegUtils.js';

export const statusRoutes = Router();

statusRoutes.get('/', async (req, res) => {
  try {
    const ffmpegAvailable = await checkFFmpegAvailable();
    
    res.json({
      providers: {
        openai: isOpenAIConfigured(),
        elevenlabs: isElevenLabsConfigured(),
        ffmpeg: ffmpegAvailable,
      },
      ready: isOpenAIConfigured() && ffmpegAvailable,
      message: !isOpenAIConfigured() 
        ? 'OpenAI API key not configured. Set OPENAI_API_KEY in .env file.'
        : !ffmpegAvailable
        ? 'FFmpeg not available. Install ffmpeg or use ffmpeg-static.'
        : 'All providers configured and ready.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});
