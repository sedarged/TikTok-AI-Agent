import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env, isTestMode } from './env.js';
import { projectRoutes } from './routes/project.js';
import { planRoutes } from './routes/plan.js';
import { sceneRoutes } from './routes/scene.js';
import { runRoutes } from './routes/run.js';
import { statusRoutes } from './routes/status.js';
import { nichePackRoutes } from './routes/nichePack.js';
import { ensureConnection } from './db/client.js';

function getAppVersion(): string {
  if (env.APP_VERSION) {
    return env.APP_VERSION;
  }

  const possiblePaths = [
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'apps', 'server', 'package.json'),
  ];

  for (const pkgPath of possiblePaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const content = fs.readFileSync(pkgPath, 'utf-8');
        const parsed = JSON.parse(content) as { version?: string };
        if (parsed.version) {
          return parsed.version;
        }
      } catch {
        // ignore
      }
    }
  }

  return 'unknown';
}

export function createApp() {
  const app = express();

  // Middleware - Allow all origins for local network access
  app.use(cors({
    origin: true, // Allow all origins for mobile access on local network
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  // Static files for artifacts
  app.use('/artifacts', express.static(env.ARTIFACTS_DIR));

  // Serve frontend in production
  const frontendDistPath = path.join(process.cwd(), '..', 'web', 'dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
  }

  // API Routes
  app.use('/api/status', statusRoutes);
  app.use('/api/niche-packs', nichePackRoutes);
  app.use('/api/project', projectRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/plan', planRoutes);
  app.use('/api/scene', sceneRoutes);
  app.use('/api/run', runRoutes);

  // Health check
  app.get('/api/health', async (req, res) => {
    const dbOk = await ensureConnection();

    res.json({
      status: 'ok',
      mode: isTestMode() ? 'test' : env.NODE_ENV,
      version: getAppVersion(),
      database: {
        ok: dbOk,
        provider: 'sqlite',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  // SPA fallback - serve index.html for all non-API routes in production
  if (fs.existsSync(frontendDistPath)) {
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/artifacts')) {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
      }
    });
  }

  return app;
}

export function startServer() {
  const app = createApp();
  return app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`Server also available on http://0.0.0.0:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Artifacts dir: ${env.ARTIFACTS_DIR}`);
    console.log(`Test mode: ${isTestMode() ? 'enabled' : 'disabled'}`);
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  startServer();
}
