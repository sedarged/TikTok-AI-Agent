import { Router } from 'express';
import { prisma } from '../db/client.js';
import { retryRun, cancelRun } from '../services/render/renderPipeline.js';
import { verifyArtifacts } from '../services/render/verifyArtifacts.js';
import { env, isTestMode } from '../env.js';
import path from 'path';
import fs from 'fs';

export const runRoutes = Router();

// Active SSE connections per runId (response objects)
const sseConnections = new Map<string, Set<import('express').Response>>();
const SSE_MAX_CONNECTIONS_PER_RUN = 100;
const SSE_HEARTBEAT_INTERVAL_MS = 25000;
const sseHeartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();

function startHeartbeat(runId: string): void {
  if (sseHeartbeatIntervals.has(runId)) return;
  const interval = setInterval(() => {
    const connections = sseConnections.get(runId);
    if (!connections || connections.size === 0) {
      clearInterval(interval);
      sseHeartbeatIntervals.delete(runId);
      return;
    }
    const message = ': heartbeat\n\n';
    for (const res of connections) {
      try {
        if (!res.writableEnded) res.write(message);
        else connections.delete(res);
      } catch {
        connections.delete(res);
      }
    }
    if (connections.size === 0) {
      clearInterval(interval);
      sseHeartbeatIntervals.delete(runId);
      sseConnections.delete(runId);
    }
  }, SSE_HEARTBEAT_INTERVAL_MS);
  sseHeartbeatIntervals.set(runId, interval);
}

// Get single run
runRoutes.get('/:runId', async (req, res) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
      include: {
        project: true,
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json(run);
  } catch (error) {
    console.error('Error getting run:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

// SSE stream for run progress (CORS handled by app-level middleware)
runRoutes.get('/:runId/stream', async (req, res) => {
  const runId = req.params.runId;

  let connections = sseConnections.get(runId);
  if (!connections) {
    connections = new Set();
    sseConnections.set(runId, connections);
  }
  if (connections.size >= SSE_MAX_CONNECTIONS_PER_RUN) {
    res.status(503).json({ error: 'Too many SSE subscribers for this run' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  connections.add(res);
  startHeartbeat(runId);

  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (run) {
    let logs: unknown[] = [];
    try {
      logs = JSON.parse(run.logsJson) as unknown[];
    } catch (error) {
      console.error('Failed to parse run logs JSON:', error);
    }
    try {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: 'state',
          status: run.status,
          progress: run.progress,
          currentStep: run.currentStep,
          logs,
        })}\n\n`);
      }
    } catch (e) {
      connections.delete(res);
    }
  }

  req.on('close', () => {
    connections.delete(res);
    if (connections.size === 0) {
      sseConnections.delete(runId);
      const interval = sseHeartbeatIntervals.get(runId);
      if (interval) {
        clearInterval(interval);
        sseHeartbeatIntervals.delete(runId);
      }
    }
  });
});

// Broadcast update to all SSE connections for a run
export function broadcastRunUpdate(runId: string, data: unknown) {
  const connections = sseConnections.get(runId);
  if (!connections) return;
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of connections) {
    try {
      if (!res.writableEnded) res.write(message);
      else connections.delete(res);
    } catch {
      connections.delete(res);
    }
  }
}

// Retry run
runRoutes.post('/:runId/retry', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Rendering is disabled in APP_TEST_MODE',
        code: 'RENDER_DISABLED_TEST_MODE',
      });
    }

    const { fromStep } = req.body;
    
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status === 'running' || run.status === 'queued') {
      return res.status(400).json({ error: 'Run is already in progress' });
    }

    const retriedRun = await retryRun(run.id, fromStep);
    res.json(retriedRun);
  } catch (error) {
    console.error('Error retrying run:', error);
    res.status(500).json({ error: 'Failed to retry run' });
  }
});

// Cancel run
runRoutes.post('/:runId/cancel', async (req, res) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status !== 'running' && run.status !== 'queued') {
      return res.status(400).json({ error: 'Run is not in progress' });
    }

    await cancelRun(run.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling run:', error);
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

// Verify artifacts
runRoutes.get('/:runId/verify', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Artifact verification disabled in APP_TEST_MODE',
        code: 'VERIFY_DISABLED_TEST_MODE',
      });
    }

    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
      include: {
        project: true,
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const verification = await verifyArtifacts(run);
    res.json(verification);
  } catch (error) {
    console.error('Error verifying artifacts:', error);
    res.status(500).json({ error: 'Failed to verify artifacts' });
  }
});

// Download final video
runRoutes.get('/:runId/download', async (req, res) => {
  try {
    if (isTestMode()) {
      return res.status(403).json({
        error: 'Downloads disabled in APP_TEST_MODE',
        code: 'DOWNLOAD_DISABLED_TEST_MODE',
      });
    }

    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    let artifacts;
    try {
      artifacts = JSON.parse(run.artifactsJson);
    } catch (error) {
      console.error('Failed to parse artifacts JSON:', error);
      return res.status(500).json({ error: 'Invalid artifacts data' });
    }

    if (artifacts.dryRun === true) {
      return res.status(409).json({
        error: 'No MP4 available for dry-run renders',
        code: 'DRY_RUN_NO_MP4',
      });
    }
    
    if (!artifacts.mp4Path) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Prevent path traversal attacks - ensure file is within ARTIFACTS_DIR
    const videoPath = path.join(env.ARTIFACTS_DIR, artifacts.mp4Path);
    const resolvedPath = path.resolve(videoPath);
    const resolvedArtifactsDir = path.resolve(env.ARTIFACTS_DIR);
    
    // Ensure the resolved path is within artifacts directory (including path separator check)
    if (!resolvedPath.startsWith(resolvedArtifactsDir + path.sep) && resolvedPath !== resolvedArtifactsDir) {
      console.error('Path traversal attempt detected:', artifacts.mp4Path);
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    res.download(resolvedPath, 'final.mp4');
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// Serve a single artifact file (used when /artifacts static is disabled, e.g. production)
runRoutes.get('/:runId/artifact', async (req, res) => {
  try {
    const runId = req.params.runId;
    const relativePath = req.query.path as string | undefined;
    if (!relativePath || relativePath.includes('..')) {
      return res.status(400).json({ error: 'Invalid or missing path' });
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
      select: { projectId: true },
    });
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const fullPath = path.join(env.ARTIFACTS_DIR, relativePath);
    const resolvedPath = path.resolve(fullPath);
    const resolvedArtifactsDir = path.resolve(env.ARTIFACTS_DIR);
    const runPrefix = path.join(resolvedArtifactsDir, run.projectId, runId);

    if (
      !resolvedPath.startsWith(resolvedArtifactsDir + path.sep) &&
      resolvedPath !== resolvedArtifactsDir
    ) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    if (!resolvedPath.startsWith(runPrefix + path.sep) && resolvedPath !== runPrefix) {
      return res.status(403).json({ error: 'Path not allowed for this run' });
    }
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(resolvedPath);
  } catch (error) {
    console.error('Error serving artifact:', error);
    res.status(500).json({ error: 'Failed to serve artifact' });
  }
});

// Get export JSON
runRoutes.get('/:runId/export', async (req, res) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.runId },
      include: {
        project: true,
        planVersion: {
          include: {
            scenes: { orderBy: { idx: 'asc' } },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    let artifacts;
    try {
      artifacts = JSON.parse(run.artifactsJson);
    } catch (error) {
      console.error('Failed to parse artifacts JSON:', error);
      return res.status(500).json({ error: 'Invalid artifacts data' });
    }
    
    const exportData = {
      project: {
        id: run.project.id,
        title: run.project.title,
        topic: run.project.topic,
        nichePackId: run.project.nichePackId,
        language: run.project.language,
        targetLengthSec: run.project.targetLengthSec,
        tempo: run.project.tempo,
        voicePreset: run.project.voicePreset,
        visualStylePreset: run.project.visualStylePreset,
      },
      plan: {
        hookSelected: run.planVersion.hookSelected,
        outline: run.planVersion.outline,
        scriptFull: run.planVersion.scriptFull,
        scenes: run.planVersion.scenes.map(s => ({
          idx: s.idx,
          narrationText: s.narrationText,
          onScreenText: s.onScreenText,
          visualPrompt: s.visualPrompt,
          durationTargetSec: s.durationTargetSec,
          effectPreset: s.effectPreset,
        })),
      },
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
      artifacts,
    };

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});
