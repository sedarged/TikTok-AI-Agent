import { Router } from 'express';
import { isOpenAIConfigured, isElevenLabsConfigured, isTestMode } from '../env.js';
import { checkFFmpegAvailable } from '../services/ffmpeg/ffmpegUtils.js';

export const statusRoutes = Router();

statusRoutes.get('/', async (req, res) => {
  try {
    const testMode = isTestMode();
    const ffmpegAvailable = testMode ? false : await checkFFmpegAvailable();

    const openaiReady = isOpenAIConfigured();
    const ready = !testMode && openaiReady && ffmpegAvailable;

    res.json({
      providers: {
        openai: openaiReady,
        elevenlabs: isElevenLabsConfigured(),
        ffmpeg: ffmpegAvailable,
      },
      ready,
      testMode,
      message: testMode
        ? 'APP_TEST_MODE enabled: rendering disabled and deterministic plan generator in use.'
        : !openaiReady 
        ? 'OpenAI API key not configured. Set OPENAI_API_KEY in .env file.'
        : !ffmpegAvailable
        ? 'FFmpeg not available. Install ffmpeg or use ffmpeg-static.'
        : 'All providers configured and ready.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});
