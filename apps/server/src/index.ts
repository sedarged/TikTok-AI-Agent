import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env, isRenderDryRun, isTestMode } from './env.js';
import { projectRoutes } from './routes/project.js';
import { planRoutes } from './routes/plan.js';
import { sceneRoutes } from './routes/scene.js';
import { runRoutes } from './routes/run.js';
import { statusRoutes } from './routes/status.js';
import { nichePackRoutes } from './routes/nichePack.js';
import { testRoutes } from './routes/test.js';
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

  // Middleware - CORS configuration
  // In production, configure specific allowed origins via ALLOWED_ORIGINS env var
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  const isDevelopment = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      
      // In development/test, allow all origins for local network access
      if (isDevelopment) return callback(null, true);
      
      // In production, check against whitelist
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // In production without configured origins, allow same-origin only
      callback(new Error('Not allowed by CORS'));
    },
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

  if (isRenderDryRun() || isTestMode()) {
    app.use('/api/test', testRoutes);
  }

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

// Check if this module is being run directly (ES Module compatible)
// Note: In CommonJS builds, this check may not work as expected
// But the module exports createApp() which can be used by tests
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
