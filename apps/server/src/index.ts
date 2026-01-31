import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import type { Server } from 'http';
import { env, isRenderDryRun, isTestMode, isNodeTest } from './env.js';
import { projectRoutes } from './routes/project.js';
import { automateRoutes } from './routes/automate.js';
import { batchRoutes } from './routes/batch.js';
import { planRoutes } from './routes/plan.js';
import { sceneRoutes } from './routes/scene.js';
import { runRoutes } from './routes/run.js';
import { statusRoutes } from './routes/status.js';
import { nichePackRoutes } from './routes/nichePack.js';
import { topicSuggestionsRoutes } from './routes/topicSuggestions.js';
import { channelPresetsRoutes } from './routes/channelPresets.js';
import { scriptTemplatesRoutes } from './routes/scriptTemplates.js';
import { testRoutes } from './routes/test.js';
import { ensureConnection } from './db/client.js';
import {
  resetStuckRuns,
  getActiveRuns,
  cancelAllActiveRuns,
} from './services/render/renderPipeline.js';
import { logError, logWarn, logInfo, logDebug } from './utils/logger.js';
import { drainSseConnections } from './routes/run.js';
import { prisma } from './db/client.js';

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
      } catch (error) {
        logDebug('Failed to parse package.json for version', { error, path: pkgPath });
      }
    }
  }

  return 'unknown';
}

function getRepoRootDir(): string {
  // If we're executed from apps/server, go up two levels to repo root
  if (process.cwd().includes('apps/server') || process.cwd().includes('apps\\server')) {
    return path.resolve(process.cwd(), '..', '..');
  }
  return process.cwd();
}

export function createApp() {
  const app = express();

  // Middleware - CORS configuration
  // In production, configure specific allowed origins via ALLOWED_ORIGINS env var
  const allowedOrigins = env.ALLOWED_ORIGINS;

  // Development-like environments for security headers (CORS, Helmet)
  const isDevLikeForSecurityHeaders =
    env.NODE_ENV === 'development' || env.NODE_ENV === 'test' || env.NODE_ENV === 'e2e';

  // Development-like environments for rate limiting
  const isDevLikeForRateLimit = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

  // Warn in production if no origins configured
  if (!isDevLikeForSecurityHeaders && allowedOrigins.length === 0) {
    logWarn(
      'ALLOWED_ORIGINS not configured in production. CORS will block browser requests. Set ALLOWED_ORIGINS environment variable to enable cross-origin requests.'
    );
  }

  // Helmet - Security headers
  app.use(
    helmet({
      contentSecurityPolicy: isDevLikeForSecurityHeaders
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
            },
          },
    })
  );

  // Rate limiting - protect API endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevLikeForRateLimit ? 1000 : 100, // More permissive in development
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (_req) => isTestMode(), // Skip rate limiting in tests
  });

  app.use('/api/', apiLimiter);
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman, same-origin)
        if (!origin) return callback(null, true);

        // In development/test, allow all origins for local network access
        if (isDevLikeForSecurityHeaders) return callback(null, true);

        // In production, check against whitelist
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In production without configured origins, reject with error
        callback(new Error('Not allowed by CORS - configure ALLOWED_ORIGINS'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Static files for artifacts: only in dev/test so production does not expose full directory
  const isProduction = env.NODE_ENV === 'production';
  if (!isProduction) {
    app.use('/artifacts', express.static(env.ARTIFACTS_DIR));
  }

  // Serve frontend in production
  const frontendDistPath = path.join(getRepoRootDir(), 'apps', 'web', 'dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
  }

  // API Routes
  app.use('/api/status', statusRoutes);
  app.use('/api/niche-packs', nichePackRoutes);
  app.use('/api/topic-suggestions', topicSuggestionsRoutes);
  app.use('/api/channel-presets', channelPresetsRoutes);
  app.use('/api/script-templates', scriptTemplatesRoutes);
  app.use('/api/project', projectRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/automate', automateRoutes);
  app.use('/api/batch', batchRoutes);
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
  app.use(
    (err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logError('Server error', err, { path: req.path, method: req.method });
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  );

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
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logInfo(`Server running on http://localhost:${env.PORT}`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      artifactsDir: env.ARTIFACTS_DIR,
      testMode: isTestMode(),
    });
    logInfo(`Server also available on http://0.0.0.0:${env.PORT}`);
    resetStuckRuns().catch((err) => logError('Failed to reset stuck runs', err));
  });

  // Setup graceful shutdown handlers
  setupGracefulShutdown(server);

  return server;
}

// Graceful shutdown handler
let isShuttingDown = false;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds

function setupGracefulShutdown(server: Server) {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logWarn('Already shutting down, ignoring signal', { signal });
      return;
    }
    isShuttingDown = true;
    logInfo(`Received ${signal}, starting graceful shutdown...`);

    // Step 1: Stop accepting new connections
    logInfo('Step 1: Stopping server from accepting new connections');
    server.close(() => {
      logInfo('HTTP server closed');
    });

    // Step 2: Cancel active renders (or wait with timeout)
    const activeRuns = getActiveRuns();
    if (activeRuns.length > 0) {
      logInfo(`Step 2: Cancelling ${activeRuns.length} active render(s)`, { activeRuns });
      try {
        await cancelAllActiveRuns();
        logInfo('Active renders cancelled successfully');
      } catch (error) {
        logError('Failed to cancel some active renders', error);
      }
    } else {
      logInfo('Step 2: No active renders to cancel');
    }

    // Step 3: Drain SSE connections
    logInfo('Step 3: Draining SSE connections');
    try {
      drainSseConnections();
      logInfo('SSE connections drained successfully');
    } catch (error) {
      logError('Failed to drain SSE connections', error);
    }

    // Step 4: Close database connection
    logInfo('Step 4: Closing database connection');
    try {
      await prisma.$disconnect();
      logInfo('Database connection closed successfully');
    } catch (error) {
      logError('Failed to close database connection', error);
    }

    logInfo('Graceful shutdown completed');
    process.exit(0);
  };

  // Handle SIGTERM (docker, kubernetes, cloud platforms)
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((err) => {
      logError('Error during SIGTERM shutdown:', err);
      process.exit(1);
    });
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((err) => {
      logError('Error during SIGINT shutdown:', err);
      process.exit(1);
    });
  });

  // Enforce shutdown timeout
  const shutdownTimeout = setTimeout(() => {
    logError('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

  // Don't let the timeout prevent shutdown
  shutdownTimeout.unref();
}

// Check if this module is being run directly (ES Module compatible)
// Note: In CommonJS builds, this check may not work as expected
// But the module exports createApp() which can be used by tests
if (!isNodeTest()) {
  startServer();
}
