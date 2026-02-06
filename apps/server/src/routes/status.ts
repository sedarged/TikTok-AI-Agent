import { Router } from 'express';
import { isOpenAIConfigured, isElevenLabsConfigured, isRenderDryRun, isTestMode } from '../env.js';
import { checkFFmpegAvailable } from '../services/ffmpeg/ffmpegUtils.js';

export const statusRoutes = Router();

statusRoutes.get('/', async (req, res) => {
  try {
    const testMode = isTestMode();
    const renderDryRun = isRenderDryRun();
    const ffmpegAvailable = testMode || renderDryRun ? false : await checkFFmpegAvailable();

    const openaiReady = isOpenAIConfigured();
    const ready = renderDryRun ? true : !testMode && openaiReady && ffmpegAvailable;

    res.json({
      providers: {
        openai: openaiReady,
        elevenlabs: isElevenLabsConfigured(),
        ffmpeg: ffmpegAvailable,
      },
      ready,
      testMode,
      renderDryRun,
      message: testMode
        ? 'APP_TEST_MODE enabled: rendering disabled and deterministic plan generator in use.'
        : renderDryRun
          ? 'APP_RENDER_DRY_RUN enabled: render pipeline runs without external providers or MP4.'
          : !openaiReady
            ? 'OpenAI API key not configured. Set OPENAI_API_KEY in .env file.'
            : !ffmpegAvailable
              ? 'FFmpeg not available. Install ffmpeg or set FFMPEG_PATH.'
              : 'All providers configured and ready.',
    });
  } catch {
    res.status(500).json({ error: 'Failed to check status' });
  }
});
