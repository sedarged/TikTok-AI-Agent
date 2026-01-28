import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { env, providerStatus } from './env.js';
import { apiRouter } from './routes/api.js';
import { detectFfmpeg } from './services/ffmpeg/bin.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Ensure artifacts dir exists (runtime output root)
fs.mkdirSync(path.resolve(env.ARTIFACTS_DIR), { recursive: true });

app.get('/api/status', (_req, res) => {
  const ff = detectFfmpeg();
  res.json({
    ok: true,
    providers: providerStatus,
    ffmpeg: {
      available: Boolean(ff.ffmpegPath && ff.ffprobePath),
      source: ff.source
    }
  });
});

app.use('/api', apiRouter);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TikTok AI server listening on http://localhost:${env.PORT}`);
});

