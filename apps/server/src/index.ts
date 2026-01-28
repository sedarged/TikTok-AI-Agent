import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './env.js';
import { projectRoutes } from './routes/project.js';
import { planRoutes } from './routes/plan.js';
import { sceneRoutes } from './routes/scene.js';
import { runRoutes } from './routes/run.js';
import { statusRoutes } from './routes/status.js';
import { nichePackRoutes } from './routes/nichePack.js';

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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
  console.log(`Server also available on http://0.0.0.0:${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Artifacts dir: ${env.ARTIFACTS_DIR}`);
});
