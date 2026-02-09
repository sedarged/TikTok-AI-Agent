import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { env, ROOT_DIR, isRenderDryRun, isTestMode, isNodeTest, isDevelopment } from './env.js';
import { projectRoutes } from './routes/project.js';
import { automateRoutes } from './routes/automate.js';
import { batchRoutes } from './routes/batch.js';
import { planRoutes } from './routes/plan.js';
import { sceneRoutes } from './routes/scene.js';
import { runRoutes } from './routes/run.js';
import { statusRoutes } from './routes/status.js';
import { nichePackRoutes } from './routes/nichePack.js';
import { topicSuggestionsRoutes } from './routes/topicSuggestions.js';
import { scriptTemplatesRoutes } from './routes/scriptTemplates.js';
import { testRoutes } from './routes/test.js';
import { requireAuthForWrites } from './middleware/auth.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { ensureConnection } from './db/client.js';
import { resetStuckRuns } from './services/render/renderPipeline.js';
import { logError, logWarn, logInfo, logDebug } from './utils/logger.js';
import { safeJsonParse } from './utils/safeJsonParse.js';

function getAppVersion(): string {
  if (env.APP_VERSION) {
    return env.APP_VERSION;
  }

  const possiblePaths = [
    path.join(ROOT_DIR, 'package.json'),
    path.join(ROOT_DIR, 'apps', 'server', 'package.json'),
  ];

  for (const pkgPath of possiblePaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const content = fs.readFileSync(pkgPath, 'utf-8');
        const parsed = safeJsonParse<{ version?: string }>(content, {}, { path: pkgPath });
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
              // Remove 'unsafe-inline' for scripts (React+Vite apps don't need it)
              // All scripts are bundled and loaded from 'self'
              scriptSrc: ["'self'"],
              // Keep 'unsafe-inline' for styles as Tailwind and other CSS-in-JS may require it
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
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
        if (isDevelopment()) return callback(null, true);

        // In production, check against whitelist
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In production without configured origins, reject with error
        callback(new Error('Not allowed by CORS - configure ALLOWED_ORIGINS'));
      },
      // SECURITY: we do not support cookie-based auth and do not enable credentialed CORS
      // This API is authenticated via Bearer tokens in the Authorization header, not cookies
      // CSRF risk is mitigated by avoiding cookie-based auth; CORS responses are non-credentialed
      credentials: false,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(requestIdMiddleware);

  // Static files for artifacts: only in dev/test so production does not expose full directory
  const isProduction = env.NODE_ENV === 'production';
  if (!isProduction) {
    app.use('/artifacts', express.static(env.ARTIFACTS_DIR));
  }

  // Serve frontend in production
  const frontendDistPath = path.join(ROOT_DIR, 'apps', 'web', 'dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
  }

  // API Routes
  // Read-only routes (no authentication required by default)
  app.use('/api/status', statusRoutes);
  app.use('/api/niche-packs', nichePackRoutes);
  app.use('/api/topic-suggestions', topicSuggestionsRoutes);
  app.use('/api/script-templates', scriptTemplatesRoutes);

  // State-changing routes (authentication required for POST/PUT/PATCH/DELETE only)
  // GET requests on these routes are allowed without authentication for backward compatibility
  app.use('/api/project', requireAuthForWrites, projectRoutes);
  app.use('/api/projects', requireAuthForWrites, projectRoutes);
  app.use('/api/automate', requireAuthForWrites, automateRoutes);
  app.use('/api/batch', requireAuthForWrites, batchRoutes);
  app.use('/api/plan', requireAuthForWrites, planRoutes);
  app.use('/api/scene', requireAuthForWrites, sceneRoutes);
  app.use('/api/run', requireAuthForWrites, runRoutes);

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
  // Express 5 requires named wildcards instead of plain '*'
  if (fs.existsSync(frontendDistPath)) {
    app.get('/{*splat}', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/artifacts')) {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
      }
    });
  }

  return app;
}

export async function startServer() {
  const app = createApp();

  // Initialize queue restoration before starting to accept connections
  // This prevents race conditions where clients could interact with the server
  // before queued runs are restored to the in-memory queue
  try {
    await resetStuckRuns();
  } catch (err) {
    logError('Failed to reset stuck runs during startup', err);
  }

  return app.listen(env.PORT, '0.0.0.0', () => {
    logInfo(`Server running on http://localhost:${env.PORT}`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      artifactsDir: env.ARTIFACTS_DIR,
      testMode: isTestMode(),
    });
    logInfo(`Server also available on http://0.0.0.0:${env.PORT}`);
  });
}

// Check if this module is being run directly (ES Module compatible)
// Note: In CommonJS builds, this check may not work as expected
// But the module exports createApp() which can be used by tests
if (!isNodeTest()) {
  startServer();
}
